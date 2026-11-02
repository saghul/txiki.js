// Raw keep-alive HTTP/1.1 server answering each request with "ok <path>" after
// delayFor(path) ms. Counts the connections it accepts and the paths it sees.
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function startDelayedServer(delayFor) {
    const server = await tjs.listen('tcp', '127.0.0.1', 0);
    const { readable, localPort } = await server.opened;
    const state = { connections: 0, paths: [] };

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

            state.connections++;
            handleConnection(accepted.value, state, delayFor);
        }
    })();

    return { server, base: `http://127.0.0.1:${localPort}`, state };
}

async function handleConnection(conn, state, delayFor) {
    const { readable, writable } = await conn.opened;
    const reader = readable.getReader();
    const writer = writable.getWriter();
    let buf = '';

    try {
        while (true) {
            const { value, done } = await reader.read();

            if (done) {
                break;
            }

            buf += decoder.decode(value, { stream: true });

            let idx;

            while ((idx = buf.indexOf('\r\n\r\n')) !== -1) {
                const path = buf.slice(0, idx).split(' ')[1];

                buf = buf.slice(idx + 4);
                state.paths.push(path);
                await new Promise(r => setTimeout(r, delayFor(path)));

                const body = `ok ${path}`;

                await writer.write(encoder.encode(`HTTP/1.1 200 OK\r\nContent-Length: ${body.length}\r\n\r\n${body}`));
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
