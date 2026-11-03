import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// Aborting one request on a shared h2 connection ends only that request's
// stream; the other streams on the connection keep going. This matters most
// for the request that *opened* the connection: its wsi becomes the h2 network
// wsi, so acting on it instead of on its own stream would kill every sibling.
//
// The server advertises only "h2" via tls.alpn, so this cannot pass over
// HTTP/1.1. allowInsecure accepts the self-signed fixture certificate.

const BODY = 'x'.repeat(4096);

async function withServer(handler, fn) {
    const server = tjs.serve({
        port: 0,
        listenIp: '127.0.0.1',
        tls: { cert, key, alpn: [ 'h2' ] },
        fetch: handler,
    });

    try {
        return await fn(`https://127.0.0.1:${server.port}/`);
    } finally {
        await server.close();
    }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// The first request ('?first') streams one chunk, then stalls before the rest,
// so it is still in flight when aborted. Every other request answers after
// `siblingDelay` ms with a 4096-byte body.
function handler({ firstDelay = 0, siblingDelay = 150 } = {}) {
    return async req => {
        if (!new URL(req.url).searchParams.has('first')) {
            await sleep(siblingDelay);

            return new Response(BODY);
        }

        await sleep(firstDelay);

        const body = new ReadableStream({
            async pull(controller) {
                controller.enqueue(new TextEncoder().encode(BODY));
                await sleep(1000);

                try {
                    controller.enqueue(new TextEncoder().encode(BODY));
                    controller.close();
                } catch {
                    // The client reset the stream.
                }
            },
        });

        return new Response(body);
    };
}

function startSiblings(url) {
    return [ 1, 2, 3 ].map(n => fetch(`${url}?n=${n}`, { allowInsecure: true })
        .then(async r => ({ status: r.status, length: (await r.text()).length })));
}

async function assertSiblingsOk(siblings, label) {
    const results = await Promise.all(siblings);

    for (const [ i, r ] of results.entries()) {
        assert.eq(r.status, 200, `${label}: sibling ${i + 1} status`);
        assert.eq(r.length, BODY.length, `${label}: sibling ${i + 1} body`);
    }
}

async function assertRejectsAbort(p, label) {
    let err;

    try {
        await p;
    } catch (e) {
        err = e;
    }

    assert.ok(err, `${label}: aborted request rejects`);
    assert.eq(err.name, 'AbortError', `${label}: rejects with AbortError`);
}

// (a) Abort the opener after reading its first body chunk, then (e) check the
// origin still serves a fresh request.
async function testAbortAfterFirstChunk() {
    await withServer(handler({ firstDelay: 20 }), async url => {
        const ac = new AbortController();
        const first = fetch(`${url}?first`, { allowInsecure: true, signal: ac.signal });
        const siblings = startSiblings(url);

        const res = await first;

        assert.eq(res.status, 200, 'a: opener status');

        const reader = res.body.getReader();
        const { value } = await reader.read();

        assert.ok(value?.length > 0, 'a: opener read its first chunk');
        ac.abort();
        await assertRejectsAbort(reader.read(), 'a');
        await assertSiblingsOk(siblings, 'a');

        const fresh = await fetch(`${url}?n=4`, { allowInsecure: true });

        assert.eq(fresh.status, 200, 'e: fresh request status');
        assert.eq((await fresh.text()).length, BODY.length, 'e: fresh request body');
    });
}

// (b) Abort the opener as soon as its response headers arrive.
async function testAbortAtHeaders() {
    await withServer(handler({ firstDelay: 20 }), async url => {
        const ac = new AbortController();
        const first = fetch(`${url}?first`, { allowInsecure: true, signal: ac.signal });
        const siblings = startSiblings(url);

        const res = await first;

        assert.eq(res.status, 200, 'b: opener status');
        ac.abort();
        await assertRejectsAbort(res.text(), 'b');
        await assertSiblingsOk(siblings, 'b');
    });
}

// (c) Abort the opener after it was sent but before its response headers
// arrive: the server holds its response well past the abort. The siblings
// start once the server has the opener's request, so they are streams on the
// established connection. (Requests issued before the connection is up wait in
// lws's queue behind the opener's transaction and are not covered here.)
async function testAbortBeforeHeaders() {
    const gotFirst = Promise.withResolvers();
    const inner = handler({ firstDelay: 2000, siblingDelay: 300 });
    const h = req => {
        if (new URL(req.url).searchParams.has('first')) {
            gotFirst.resolve();
        }

        return inner(req);
    };

    await withServer(h, async url => {
        const ac = new AbortController();
        const first = fetch(`${url}?first`, { allowInsecure: true, signal: ac.signal });

        await gotFirst.promise;

        const siblings = startSiblings(url);

        setTimeout(() => ac.abort(), 150);
        await assertRejectsAbort(first, 'c');
        await assertSiblingsOk(siblings, 'c');
    });
}

// (d) Control: abort a request that joined a warm connection.
async function testAbortJoiner() {
    await withServer(handler({ firstDelay: 20 }), async url => {
        const warm = await fetch(`${url}?n=0`, { allowInsecure: true });

        assert.eq((await warm.text()).length, BODY.length, 'd: warm-up request');

        const ac = new AbortController();
        const joiner = fetch(`${url}?first`, { allowInsecure: true, signal: ac.signal });
        const siblings = startSiblings(url);

        const res = await joiner;

        ac.abort();
        await assertRejectsAbort(res.text(), 'd');
        await assertSiblingsOk(siblings, 'd');
    });
}

await testAbortAfterFirstChunk();
await testAbortAtHeaders();
await testAbortBeforeHeaders();
await testAbortJoiner();
