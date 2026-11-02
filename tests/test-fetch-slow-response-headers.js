// fetch() and XHR wait for the response headers with no implicit limit: only
// the user's AbortSignal / XHR timeout ends the wait, as in browsers. lws's own
// reply timer (15 s) must not cut it. A raw TCP server is used so the test
// doesn't depend on tjs.serve's own handler limits. The three cases run
// concurrently to keep the file under the runner's 30 s test timeout, each
// against its own server so they don't queue on one pooled h1 connection.
import assert from 'tjs:assert';

const DELAY_MS = 18000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function startServer() {
    const server = await tjs.listen('tcp', '127.0.0.1', 0);
    const { readable, localPort: port } = await server.opened;
    const conns = new Set();

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

            handleConnection(accepted.value, conns);
        }
    })();

    return {
        url: `http://127.0.0.1:${port}/`,
        async close() {
            for (const conn of conns) {
                conn.close();
            }

            await server.close();
        },
    };
}

// Reads the request head, then answers only after DELAY_MS.
async function handleConnection(conn, conns) {
    conns.add(conn);

    const { readable, writable } = await conn.opened;
    const reader = readable.getReader();
    const writer = writable.getWriter();
    let buf = '';

    try {
        while (!buf.includes('\r\n\r\n')) {
            const { value, done } = await reader.read();

            if (done) {
                return;
            }

            buf += decoder.decode(value, { stream: true });
        }

        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        await writer.write(encoder.encode('HTTP/1.1 200 OK\r\nContent-Length: 4\r\nConnection: close\r\n\r\nlate'));
    } catch {
        // The client may drop the connection first (the aborted cases).
    } finally {
        conns.delete(conn);
        conn.close();
    }
}

async function slowFetch(url) {
    const t0 = performance.now();
    const r = await fetch(url);
    const body = await r.text();
    const elapsed = performance.now() - t0;

    assert.eq(r.status, 200, 'slow fetch status');
    assert.eq(body, 'late', 'slow fetch body');
    assert.ok(elapsed >= 15000, `slow fetch waited past lws's 15 s reply timer (${Math.round(elapsed)} ms)`);
}

async function abortedFetch(url) {
    const t0 = performance.now();
    let error;

    try {
        await fetch(url, { signal: AbortSignal.timeout(1000) });
    } catch (e) {
        error = e;
    }

    const elapsed = performance.now() - t0;

    assert.ok(error, 'AbortSignal.timeout() rejected the fetch');
    assert.ok([ 'AbortError', 'TimeoutError' ].includes(error.name), `fetch rejected with ${error.name}`);
    assert.ok(elapsed < 5000, `the abort ended the wait in ~1 s (${Math.round(elapsed)} ms)`);
}

async function timedOutXhr(url) {
    const t0 = performance.now();
    const done = Promise.withResolvers();
    const xhr = new XMLHttpRequest();
    let timedOut = false;

    xhr.timeout = 1000;

    xhr.ontimeout = () => {
        timedOut = true;
    };

    xhr.onloadend = () => done.resolve();
    xhr.open('GET', url);
    xhr.send();

    await done.promise;

    const elapsed = performance.now() - t0;

    assert.ok(timedOut, 'XHR ontimeout fired');
    assert.ok(elapsed < 5000, `the XHR timeout ended the wait in ~1 s (${Math.round(elapsed)} ms)`);
}

const servers = await Promise.all([ startServer(), startServer(), startServer() ]);

try {
    await Promise.all([
        slowFetch(servers[0].url),
        abortedFetch(servers[1].url),
        timedOutXhr(servers[2].url),
    ]);
} finally {
    await Promise.all(servers.map(s => s.close()));
}
