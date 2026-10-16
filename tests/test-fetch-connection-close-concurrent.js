// Fetches issued in the same tick to one origin are queued on the first one's
// connection. When that connection's response says it won't be kept alive
// ("Connection: close", or an HTTP/1.0 status line), the queued requests must
// be restarted on connections of their own and succeed, not left hanging.
import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Raw server that answers exactly one request per connection with
// `respond(path)` and then closes the connection.
async function startServer(respond) {
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
            handleConnection(accepted.value, state, respond);
        }
    })();

    return { server, base: `http://127.0.0.1:${localPort}`, state };
}

async function handleConnection(conn, state, respond) {
    const { readable, writable } = await conn.opened;
    const reader = readable.getReader();
    const writer = writable.getWriter();
    let buf = '';

    try {
        while (true) {
            const { value, done } = await reader.read();

            if (done) {
                return;
            }

            buf += decoder.decode(value, { stream: true });

            const idx = buf.indexOf('\r\n\r\n');

            if (idx !== -1) {
                const path = buf.slice(0, idx).split(' ')[1];

                state.paths.push(path);
                await writer.write(encoder.encode(respond(path)));
                break;
            }
        }
    } catch {
        // The client went away; nothing to do.
    }

    conn.close();
}

async function fetchConcurrently(base, paths) {
    let timer;
    const watchdog = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('queued fetches never settled')), 5000);
    });

    try {
        return await Promise.race([
            Promise.all(paths.map(p => fetch(base + p).then(r => r.text()))),
            watchdog,
        ]);
    } finally {
        clearTimeout(timer);
    }
}

const paths = [ '/r0', '/r1', '/r2' ];

for (const statusLine of [ 'HTTP/1.1 200 OK\r\nConnection: close', 'HTTP/1.0 200 OK' ]) {
    const { server, base, state } = await startServer(path => {
        const body = `ok ${path}`;

        return `${statusLine}\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
    });

    const bodies = await fetchConcurrently(base, paths);

    assert.eq(bodies.join(','), paths.map(p => `ok ${p}`).join(','), `${statusLine}: every fetch got its body`);
    assert.eq(state.paths.toSorted().join(','), paths.join(','), `${statusLine}: server saw every request`);
    assert.eq(state.connections, 3, `${statusLine}: one connection per request (accepted ${state.connections})`);

    await server.close();
}
