import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function raw(port, request) {
    const con = await tjs.connect('tcp', '127.0.0.1', port);
    const { readable, writable } = await con.opened;
    const writer = writable.getWriter();

    // The server may close as soon as it sees the bad framing, so a write or a
    // read may fail: either way it ends what the client gets back. The write
    // side is left open: the server closes the connection (Connection: close).
    try {
        await writer.write(encoder.encode(request));
    } catch {}

    const reader = readable.getReader();
    const chunks = [];
    const timedOut = Symbol('timeout');

    // The failsafe only keeps a hung server from hanging the test: running
    // into it is a failure, so it is reported as its own outcome.
    let timer;
    const failsafe = new Promise(resolve => {
        timer = setTimeout(() => resolve(timedOut), 5000);
    });
    let end;

    while (true) {
        let result;

        try {
            result = await Promise.race([ reader.read(), failsafe ]);
        } catch {
            end = 'error';
            break;
        }

        if (result === timedOut) {
            end = 'timeout';
            break;
        }

        if (result.done) {
            end = 'eof';
            break;
        }

        chunks.push(decoder.decode(result.value, { stream: true }));
    }

    clearTimeout(timer);

    try {
        con.close();
    } catch {}

    return { text: chunks.join(''), end };
}

function chunked(path, body) {
    return 'POST ' + path + ' HTTP/1.1\r\n' +
        'Host: 127.0.0.1\r\n' +
        'Transfer-Encoding: chunked\r\n' +
        'Connection: close\r\n' +
        '\r\n' +
        body;
}

const bodies = new Map();
const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    fetch: async req => {
        const path = new URL(req.url).pathname;
        const body = await req.text();

        bodies.set(path, body);

        return new Response('got:' + body);
    },
});

// The framing is enforced by txiki's own de-chunker on lws < 5.1 and by lws's
// on lws >= 5.1. Either closes the connection without answering (or could
// answer with a 4xx); what must never happen is the handler seeing the whole
// body and the client getting a 2xx back.
const malformed = [
    // (a) a chunk size that is not hex
    [ '/not-hex', 'zz\r\nhello\r\n0\r\n\r\n', 'hello' ],

    // (b) a chunk size that overflows 64 bits (17 hex digits)
    [ '/overflow', 'fffffffffffffffff\r\nhello\r\n0\r\n\r\n', 'hello' ],

    // (c) chunk data not followed by CRLF
    [ '/no-crlf', '5\r\nhelloXX5\r\nworld\r\n0\r\n\r\n', 'helloworld' ],
];

for (const [ path, body, whole ] of malformed) {
    const { text, end } = await raw(server.port, chunked(path, body));

    assert.ok(end !== 'timeout', `${path}: the server ends the connection instead of hanging`);
    assert.ok(text === '' || /^HTTP\/1\.[01] 4\d\d /.test(text), `${path}: closed or 4xx, got ${JSON.stringify(text)}`);

    // Give the handler a chance to see whatever the server delivered.
    await delay(100);

    // The handler is invoked at the head, so it may see the payload that came
    // before the bad framing (e.g. "hello" in (c)), never what came after it.
    assert.ok(bodies.get(path) !== whole, `${path}: the handler never gets the whole body`);
}

// (d) control: a valid two-chunk body is delivered intact.
const { text: ok, end: okEnd } = await raw(server.port, chunked('/valid', '5\r\nhello\r\n6\r\n world\r\n0\r\n\r\n'));

assert.eq(okEnd, 'eof', 'valid chunked request ends with the server closing (Connection: close)');
assert.ok(ok.startsWith('HTTP/1.1 200'), `valid chunked request is answered with 200, got ${JSON.stringify(ok)}`);
assert.ok(ok.includes('got:hello world'), `valid chunked body is echoed back, got ${JSON.stringify(ok)}`);
assert.eq(bodies.get('/valid'), 'hello world', 'valid chunked body is delivered intact');

await server.close();
