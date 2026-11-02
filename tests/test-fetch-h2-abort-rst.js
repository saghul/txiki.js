import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// Skipped under GC stress: h2 response bodies stall there (t_a77e0129), so the
// timing this test relies on no longer holds.
if (tjs.env.TJS_GC_STRESS) {
    tjs.exit(0);
}

// HTTP/2: aborting a fetch that shares a pooled connection resets its stream
// (RST_STREAM), so the server stops producing that response body: its cancel()
// runs. The other streams on the connection keep delivering, and the
// connection stays usable.
//
// The server advertises only "h2", so this can never pass over HTTP/1.1, where
// an abort closes the whole socket.

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const FULL = 4096;

async function withServer(fn) {
    const states = new Map();
    const server = tjs.serve({
        port: 0,
        listenIp: '127.0.0.1',
        tls: { cert, key, alpn: [ 'h2' ] },
        fetch: req => {
            const url = new URL(req.url);

            if (url.pathname === '/full') {
                return new Response('x'.repeat(FULL));
            }

            // Never ends on its own.
            const state = { pushes: 0, cancelled: false };

            states.set(url.searchParams.get('n'), state);

            return new Response(new ReadableStream({
                async pull(controller) {
                    await sleep(5);
                    controller.enqueue(new Uint8Array(1024));
                    state.pushes++;
                },
                cancel() {
                    state.cancelled = true;
                },
            }));
        },
    });

    try {
        return await fn(`https://127.0.0.1:${server.port}`, states);
    } finally {
        await server.close();
    }
}

async function waitCancelled(state, what) {
    const deadline = Date.now() + 1000;

    while (!state.cancelled && Date.now() < deadline) {
        await sleep(10);
    }

    assert.ok(state.cancelled, `${what}: server body cancel() called within 1 s (pushes ${state.pushes})`);
}

async function readBytes(reader, min) {
    let got = 0;

    while (got < min) {
        const { done, value } = await reader.read();

        assert.ok(!done, 'stream still delivering');
        got += value.length;
    }

    return got;
}

async function testJoinedStreamAbort() {
    await withServer(async (base, states) => {
        const warm = await fetch(`${base}/full`, { allowInsecure: true });

        assert.eq((await warm.text()).length, FULL, 'warm-up fetch completed');

        const acs = [ 0, 1, 2 ].map(() => new AbortController());
        const responses = await Promise.all([ 0, 1, 2 ].map(n =>
            fetch(`${base}/s?n=${n}`, { allowInsecure: true, signal: acs[n].signal })));
        const readers = responses.map(r => r.body.getReader());

        for (const reader of readers) {
            await readBytes(reader, 1);
        }

        acs[1].abort();

        const aborted = await readers[1].read().then(() => 'read', e => e.name);

        assert.eq(aborted, 'AbortError', 'aborted stream errors');
        await waitCancelled(states.get('1'), 'aborted joined stream #1');

        for (const n of [ 0, 2 ]) {
            await readBytes(readers[n], 8 * 1024);
            assert.ok(!states.get(String(n)).cancelled, `stream #${n} not cancelled by #1's abort`);
        }

        for (const n of [ 0, 2 ]) {
            acs[n].abort();
            await waitCancelled(states.get(String(n)), `aborted stream #${n}`);
        }

        // The connection is still usable after its streams were reset.
        const r = await fetch(`${base}/full`, { allowInsecure: true });

        assert.eq(r.status, 200, 'fetch after the resets: status');
        assert.eq((await r.text()).length, FULL, 'fetch after the resets: full body');
    });
}

// No warm-up: #0 opens the connection and #1/#2 join it. #0's request runs on
// a stream of its own, not on the connection, so aborting it resets only that
// stream.
async function testOpenerStreamAbort() {
    await withServer(async (base, states) => {
        const acs = [ 0, 1, 2 ].map(() => new AbortController());
        const responses = await Promise.all([ 0, 1, 2 ].map(n =>
            fetch(`${base}/s?n=${n}`, { allowInsecure: true, signal: acs[n].signal })));
        const readers = responses.map(r => r.body.getReader());

        for (const reader of readers) {
            await readBytes(reader, 1);
        }

        acs[0].abort();

        const aborted = await readers[0].read().then(() => 'read', e => e.name);

        assert.eq(aborted, 'AbortError', 'aborted opener stream errors');
        await waitCancelled(states.get('0'), 'aborted opener stream #0');

        for (const n of [ 1, 2 ]) {
            await readBytes(readers[n], 8 * 1024);
            assert.ok(!states.get(String(n)).cancelled, `stream #${n} not cancelled by #0's abort`);
        }

        for (const n of [ 1, 2 ]) {
            acs[n].abort();
            await waitCancelled(states.get(String(n)), `aborted stream #${n}`);
        }
    });
}

await testJoinedStreamAbort();
await testOpenerStreamAbort();
