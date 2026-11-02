import assert from 'tjs:assert';

let hits = 0;

const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    fetch: () => {
        hits++;

        return new Response('ok');
    },
});

const url = `http://127.0.0.1:${server.port}/`;

async function assertAbortError(p, label) {
    let error;

    try {
        await p;
    } catch (e) {
        error = e;
    }

    assert.ok(error, `${label}: fetch should reject`);
    assert.eq(error.name, 'AbortError', `${label}: rejects with AbortError`);
}

// GET without a body, aborted in the same tick fetch() was called.
{
    const ac = new AbortController();
    const p = fetch(url, { signal: ac.signal });

    ac.abort();
    await assertAbortError(p, 'same tick, no body');
}

// POST with a string body, aborted while the body is being read.
{
    const ac = new AbortController();
    const p = fetch(url, { method: 'POST', body: 'x', signal: ac.signal });

    ac.abort();
    await assertAbortError(p, 'same tick, string body');
}

// POST with a ReadableStream body; the stream must be cancelled.
{
    const ac = new AbortController();
    const { promise: cancelled, resolve: onCancel } = Promise.withResolvers();
    const body = new ReadableStream({
        pull(controller) {
            controller.enqueue(new TextEncoder().encode('x'));
            controller.close();
        },
        cancel(reason) {
            onCancel(reason);
        },
    });
    const p = fetch(url, { method: 'POST', body, duplex: 'half', signal: ac.signal });

    ac.abort();
    await assertAbortError(p, 'same tick, stream body');

    const reason = await cancelled;

    assert.eq(reason?.name, 'AbortError', 'stream body is cancelled with AbortError');
}

assert.eq(hits, 0, 'no same-tick aborted request reaches the server');

// Aborted after a microtask: still before the connection is opened.
{
    const ac = new AbortController();
    const p = fetch(url, { signal: ac.signal });

    await null;
    ac.abort();
    await assertAbortError(p, 'after microtask');
}

// Nothing is left wedged: a normal fetch still succeeds.
{
    const r = await fetch(url);

    assert.eq(r.status, 200, 'follow-up fetch succeeds');
    assert.eq(await r.text(), 'ok', 'follow-up fetch body');
}

await server.close();
