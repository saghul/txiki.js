// fetch reuses a kept-alive connection for repeated requests to the same
// origin instead of opening a fresh TCP connection each time (lws
// LCCSCF_PIPELINE keep-alive). We prove reuse with a raw TCP server that
// counts how many connections it accepts: N sequential requests must all ride
// a single accepted connection.
import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Minimal HTTP/1.1 keep-alive server on a raw TCP socket. Counts accepted
// connections; answers every request on a connection without closing it.
async function startCountingServer() {
    const server = await tjs.listen('tcp', '127.0.0.1', 0);
    const { readable, localPort } = await server.opened;

    const state = { connections: 0, requests: 0 };

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

            const connId = state.connections++;

            handleConnection(accepted.value, connId, state);
        }
    })();

    return { server, port: localPort, state };
}

async function handleConnection(conn, connId, state) {
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

            // Process every complete request (GET, no body) in the buffer.
            let idx;

            while ((idx = buf.indexOf('\r\n\r\n')) !== -1) {
                const head = buf.slice(0, idx);

                buf = buf.slice(idx + 4);
                state.requests++;

                const path = head.split(' ')[1] || '/';
                const body = `conn=${connId} path=${path}`;
                const res = `HTTP/1.1 200 OK\r\n` +
                    `Content-Type: text/plain\r\n` +
                    `Content-Length: ${body.length}\r\n` +
                    `Connection: keep-alive\r\n\r\n` +
                    body;

                await writer.write(encoder.encode(res));
            }
        }
    } catch {
        // Connection dropped; nothing to clean up beyond letting it go.
    }
}

const { server, port, state } = await startCountingServer();
const base = `http://127.0.0.1:${port}`;

const N = 5;
const bodies = [];

for (let i = 0; i < N; i++) {
    const r = await fetch(`${base}/req${i}`);

    assert.eq(r.status, 200, `req${i} status is 200`);
    bodies.push(await r.text());
}

assert.eq(state.requests, N, `server saw all ${N} requests`);

// The crux: every request rode the same, first-accepted connection.
assert.eq(state.connections, 1, `all ${N} requests reused a single connection (accepted ${state.connections})`);

for (let i = 0; i < N; i++) {
    assert.eq(bodies[i], `conn=0 path=/req${i}`, `req${i} served by connection 0`);
}

await server.close();
