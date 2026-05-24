import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function raw(port, parts) {
    const con = await tjs.connect('tcp', '127.0.0.1', port);
    const { readable, writable } = await con.opened;
    const writer = writable.getWriter();

    for (const part of parts) {
        await writer.write(encoder.encode(part));
        await delay(10);
    }

    try {
        await writer.close();
    } catch {}

    const reader = readable.getReader();
    const chunks = [];

    while (true) {
        const read = reader.read();
        const timeout = delay(500).then(() => ({ done: true, timeout: true }));
        const { value, done, timeout: timedOut } = await Promise.race([ read, timeout ]);

        if (done || timedOut) {
            break;
        }

        chunks.push(decoder.decode(value, { stream: true }));
    }

    try {
        con.close();
    } catch {}

    return chunks.join('');
}

const bodies = [];
const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    fetch: async (req) => {
        const body = await req.text();
        bodies.push(body);
        return new Response(body);
    },
});

const validResponse = await raw(server.port, [
    'POST / HTTP/1.1\r\n' +
        'Host: 127.0.0.1\r\n' +
        'Transfer-Encoding: chunked\r\n' +
        'Connection: close\r\n' +
        '\r\n' +
        '5;foo=bar\r\nhe',
    'llo\r\n6\r\n wor',
    'ld\r\n0\r\n\r\n',
]);

assert.ok(validResponse.includes('hello world'), 'valid split chunked body is echoed');
assert.eq(bodies[0], 'hello world', 'valid split chunked body is delivered');

const beforeOversized = bodies.length;
await raw(server.port, [
    'POST / HTTP/1.1\r\n' +
        'Host: 127.0.0.1\r\n' +
        'Transfer-Encoding: chunked\r\n' +
        'Connection: close\r\n' +
        '\r\n' +
        'ffffffffffffffff\r\n' +
        'AAAA\r\n0\r\n\r\n',
]);
await delay(100);

if (bodies.length > beforeOversized) {
    assert.notEqual(bodies[beforeOversized], 'AAAA\r\n0\r\n\r\n', 'oversized chunk is not delivered');
}

const beforeMalformed = bodies.length;
await raw(server.port, [
    'POST / HTTP/1.1\r\n' +
        'Host: 127.0.0.1\r\n' +
        'Transfer-Encoding: chunked\r\n' +
        'Connection: close\r\n' +
        '\r\n' +
        'g\r\nHELLO\r\n0\r\n\r\n',
]);
await delay(100);

if (bodies.length > beforeMalformed) {
    assert.notEqual(bodies[beforeMalformed], 'HELLO', 'malformed chunk is not delivered');
}

await server.close();
