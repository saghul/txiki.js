// Raw keep-alive HTTP/1.1 server whose first connection goes stale: connection
// 0 handles its first request and then closes, without sending
// "Connection: close" (a server's keep-alive idle timeout racing the client's
// next request). In mode 'reply-then-close' it replies and then only
// half-closes: the client sees a FIN, but the server keeps reading, so a
// request written onto the stale connection is recorded (never answered) and
// a retry can be told apart from a request that went out on a fresh
// connection in the first place. In mode 'close-before-reply' it fully
// closes without replying. Later connections reply to every request with
// "ok <path>". It records every request it reads and counts the connections
// it accepts. staleDone settles once connection 0 is gone (the client closed
// it); await it before reading state.requests, since the client can report a
// failure before the server has read the stale write.
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function startStaleKeepAliveServer(mode = 'reply-then-close') {
    const server = await tjs.listen('tcp', '127.0.0.1', 0);
    const { readable, localPort } = await server.opened;
    const state = { connections: 0, requests: [] };
    const conns = [];
    const { promise: staleDone, resolve: resolveStaleDone } = Promise.withResolvers();

    (async () => {
        const reader = readable.getReader();

        while (true) {
            let accepted;

            try {
                accepted = await reader.read();
            } catch {
                break;
            }

            if (accepted.done) {
                break;
            }

            const connIndex = state.connections++;

            conns.push(accepted.value);

            const handled = handleConnection(accepted.value, connIndex, state, mode);

            if (connIndex === 0) {
                handled.then(resolveStaleDone);
            }
        }
    })();

    const close = async () => {
        for (const conn of conns) {
            try {
                conn.close();
            } catch {
                // Already closed.
            }
        }

        await server.close();
    };

    return { base: `http://127.0.0.1:${localPort}`, state, staleDone, close };
}

async function handleConnection(conn, connIndex, state, mode) {
    const { readable, writable } = await conn.opened;
    const reader = readable.getReader();
    const writer = writable.getWriter();
    let buf = '';
    let halfClosed = false;

    const fill = async () => {
        const { value, done } = await reader.read();

        if (done) {
            throw new Error('EOF');
        }

        buf += decoder.decode(value, { stream: true });
    };

    try {
        while (true) {
            let idx;

            while ((idx = buf.indexOf('\r\n\r\n')) === -1) {
                await fill();
            }

            const [ requestLine, ...headerLines ] = buf.slice(0, idx).split('\r\n');
            const [ method, path ] = requestLine.split(' ');
            const headers = new Map(headerLines.map(l => {
                const colon = l.indexOf(':');

                return [ l.slice(0, colon).trim().toLowerCase(), l.slice(colon + 1).trim() ];
            }));
            const length = Number(headers.get('content-length') ?? 0);

            while (buf.length < idx + 4 + length) {
                await fill();
            }

            const body = buf.slice(idx + 4, idx + 4 + length);

            buf = buf.slice(idx + 4 + length);
            state.requests.push({ connIndex, method, path, body, probe: headers.get('x-probe') ?? null });

            const stale = connIndex === 0;

            if (stale && mode === 'close-before-reply') {
                break;
            }

            if (halfClosed) {
                continue;
            }

            // Give requests issued in the same tick time to queue on this connection.
            await new Promise(r => setTimeout(r, 10));

            const text = `ok ${path}`;
            const head = `HTTP/1.1 200 OK\r\nContent-Length: ${text.length}\r\n\r\n`;

            await writer.write(encoder.encode(method === 'HEAD' ? head : head + text));

            if (stale) {
                // Shuts down the write side only; the loop reads until the client closes.
                await writer.close();
                halfClosed = true;
            }
        }
    } catch {
        // The client went away.
    }

    conn.close();
}

// Settle within 5 s, or fail: a hang must fail the test, not time out the suite.
export async function withWatchdog(promise, what) {
    let timer;
    const watchdog = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${what}: never settled`)), 5000);
    });

    try {
        return await Promise.race([ promise, watchdog ]);
    } finally {
        clearTimeout(timer);
    }
}
