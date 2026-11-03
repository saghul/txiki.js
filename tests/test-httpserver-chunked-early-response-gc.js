import assert from 'tjs:assert';

// A handler that responds before a chunked request body has fully arrived
// must not leak the body stream: it is errored when the response completes.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const head = path =>
    `POST ${path} HTTP/1.1\r\n` +
    'Host: 127.0.0.1\r\n' +
    'Transfer-Encoding: chunked\r\n' +
    'Connection: close\r\n' +
    '\r\n' +
    '5\r\nhello\r\n';
const rest = '6\r\n world\r\n0\r\n\r\n';

// Send the head and the first chunk; when `early`, wait for the response
// before sending the rest, so the response always completes first.
async function request(port, path, early) {
    const con = await tjs.connect('tcp', '127.0.0.1', port);
    const { readable, writable } = await con.opened;
    const writer = writable.getWriter();
    const reader = readable.getReader();
    const sendRest = async () => {
        try {
            await writer.write(encoder.encode(rest));
        } catch {
            // The server may already have closed the connection.
        }
    };

    await writer.write(encoder.encode(head(path)));

    if (!early) {
        await sendRest();
    }

    let response = '';
    let timer;
    const deadline = new Promise(resolve => {
        timer = setTimeout(() => resolve({ done: true }), 5000);
    });

    while (true) {
        let result;

        try {
            result = await Promise.race([ reader.read(), deadline ]);
        } catch {
            break;
        }

        if (result.done) {
            break;
        }

        response += decoder.decode(result.value, { stream: true });

        if (early && response.includes('\r\n\r\n')) {
            early = false;
            await sendRest();
        }
    }

    clearTimeout(timer);

    try {
        con.close();
    } catch {}

    return response;
}

const earlyRefs = [];
const consumedRefs = [];
const consumedTexts = [];
const partialErrors = [];

const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    fetch: async req => {
        const path = new URL(req.url).pathname;

        if (path === '/early') {
            earlyRefs.push(new WeakRef(req.body));

            return new Response('early');
        }

        if (path === '/partial') {
            const reader = req.body.getReader();
            const first = await reader.read();

            assert.eq(decoder.decode(first.value), 'hello', 'first chunk is delivered');
            partialErrors.push(reader.read().then(() => null, e => e));

            return new Response('partial');
        }

        consumedRefs.push(new WeakRef(req.body));
        const text = await req.text();

        consumedTexts.push(text);

        return new Response(text);
    },
});

const N = 10;

for (let i = 0; i < N; i++) {
    const early = await request(server.port, '/early', true);

    assert.ok(early.startsWith('HTTP/1.1 200'), 'early response is sent');
    assert.ok(early.endsWith('early'), 'early response body is sent');

    const consumed = await request(server.port, '/consumed', false);

    assert.ok(consumed.endsWith('hello world'), 'consumed body is echoed');
}

const partial = await request(server.port, '/partial', true);

assert.ok(partial.endsWith('partial'), 'partial response is sent');
assert.eq(partialErrors.length, 1);

let partialTimer;
const err = await Promise.race([
    partialErrors[0],
    new Promise(resolve => {
        partialTimer = setTimeout(() => resolve('timed out'), 10000);
    }),
]);

clearTimeout(partialTimer);

assert.ok(err instanceof TypeError, 'pending read of an unfinished body rejects with a TypeError');

assert.eq(consumedTexts.length, N);

for (const text of consumedTexts) {
    assert.eq(text, 'hello world', 'consumed body is complete');
}

tjs.engine.gc.run();
await delay(10);
tjs.engine.gc.run();

assert.eq(earlyRefs.length, N);
assert.eq(earlyRefs.filter(r => r.deref()).length, 0, 'unread early-response bodies are collected');
assert.eq(consumedRefs.length, N);
assert.eq(consumedRefs.filter(r => r.deref()).length, 0, 'consumed bodies are collected');

await server.close();
