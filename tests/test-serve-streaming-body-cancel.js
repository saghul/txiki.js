import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// A streaming response body is cancelled once its request goes away: the
// client aborts, or the server is closed. The source's cancel() runs and pull()
// is not called again, so nothing the body awaits keeps the process alive (if
// it did, this file would never exit and the runner would time it out).

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function producingBody(state) {
    return new ReadableStream({
        async pull(controller) {
            await sleep(5);
            controller.enqueue(new Uint8Array(1024));
            state.pushes++;
        },
        cancel() {
            state.cancelled = true;
        },
    });
}

// After the first chunk, pull() never settles, so the server never calls
// sendBody again: only the close notification (or server.close()) can cancel it.
function stalledBody(state) {
    return new ReadableStream({
        pull(controller) {
            if (state.pushes === 0) {
                controller.enqueue(new Uint8Array(1024));
                state.pushes++;

                return;
            }

            return new Promise(() => {});
        },
        cancel() {
            state.cancelled = true;
        },
    });
}

// pull() never settles and never enqueues, so sendBody is never called.
function pendingBody(state) {
    return new ReadableStream({
        pull() {
            return new Promise(() => {});
        },
        cancel() {
            state.cancelled = true;
        },
    });
}

async function waitCancelled(state, what) {
    const deadline = Date.now() + 1000;

    while (!state.cancelled && Date.now() < deadline) {
        await sleep(10);
    }

    assert.ok(state.cancelled, `${what}: body cancel() called within 1 s`);

    const before = state.pushes;

    await sleep(200);
    assert.ok(state.pushes <= before + 1, `${what}: pull() stopped (${before} -> ${state.pushes})`);
}

async function runCase({ name, h2, makeBody, mode }) {
    const state = { pushes: 0, cancelled: false };
    const server = tjs.serve({
        port: 0,
        listenIp: '127.0.0.1',
        tls: h2 ? { cert, key, alpn: [ 'h2' ] } : undefined,
        fetch: () => new Response(makeBody(state)),
    });
    const ac = new AbortController();
    const scheme = h2 ? 'https' : 'http';
    const r = await fetch(`${scheme}://127.0.0.1:${server.port}/`, { allowInsecure: true, signal: ac.signal });
    const reader = r.body.getReader();
    const first = await reader.read();

    assert.ok(!first.done && first.value.length > 0, `${name}: got a first chunk`);

    const consumed = (async () => {
        try {
            while (!(await reader.read()).done) {
                // Drain.
            }
        } catch {
            // Aborted / connection closed.
        }
    })();

    if (mode === 'server-close') {
        await server.close();
        await waitCancelled(state, name);
    } else {
        ac.abort();
        await waitCancelled(state, name);
        await server.close();
    }

    await consumed;
}

// The request goes away while the handler is still pending: the body must be
// cancelled as soon as the handler returns it, not only at server.close().
async function runPendingHandlerCase({ name, h2, mode }) {
    const state = { pushes: 0, cancelled: false };
    const { promise: started, resolve: start } = Promise.withResolvers();
    const { promise: resolved, resolve } = Promise.withResolvers();
    const server = tjs.serve({
        port: 0,
        listenIp: '127.0.0.1',
        tls: h2 ? { cert, key, alpn: [ 'h2' ] } : undefined,
        fetch: async () => {
            start();
            await sleep(200);
            resolve();

            return new Response(pendingBody(state));
        },
    });
    const ac = new AbortController();
    const scheme = h2 ? 'https' : 'http';
    const f = fetch(`${scheme}://127.0.0.1:${server.port}/`, { allowInsecure: true, signal: ac.signal })
        .catch(() => {});

    // Aborting or closing before the request reaches the handler would leave
    // `resolved` pending forever, so wait for the handler rather than a fixed delay.
    await started;

    if (mode === 'server-close') {
        await server.close();
        await resolved;
        await waitCancelled(state, name);
    } else {
        ac.abort();
        await resolved;
        await waitCancelled(state, name);
        await server.close();
    }

    await f;
}

await runCase({ name: 'h2 server.close()', h2: true, makeBody: producingBody, mode: 'server-close' });
await runCase({ name: 'h2 client abort', h2: true, makeBody: producingBody, mode: 'client-abort' });
await runCase({ name: 'h1 server.close()', h2: false, makeBody: producingBody, mode: 'server-close' });
await runCase({ name: 'h1 client abort', h2: false, makeBody: producingBody, mode: 'client-abort' });
await runCase({ name: 'h2 stalled body, client abort', h2: true, makeBody: stalledBody, mode: 'client-abort' });
await runCase({ name: 'h2 stalled body, server.close()', h2: true, makeBody: stalledBody, mode: 'server-close' });
await runPendingHandlerCase({ name: 'h2 pending handler, client abort', h2: true, mode: 'client-abort' });
await runPendingHandlerCase({ name: 'h1 pending handler, client abort', h2: false, mode: 'client-abort' });
await runPendingHandlerCase({ name: 'h2 pending handler, server.close()', h2: true, mode: 'server-close' });
