import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// A ReadableStream request body is delivered over h2 as plain DATA frames
// ended by END_STREAM, with no Transfer-Encoding (forbidden in h2, RFC 9113
// §8.2.2) and no chunked framing in the payload.
//
// The server advertises only "h2" via tls.alpn, so the connection must be
// HTTP/2. allowInsecure accepts the self-signed fixture certificate. Every
// fetch has a timeout so a body that never ends fails instead of hanging.

const TIMEOUT_MS = 5000;

async function withServer(fn) {
    const server = tjs.serve({
        port: 0,
        listenIp: '127.0.0.1',
        tls: { cert, key, alpn: [ 'h2' ] },
        fetch: async (req, info) =>
            new Response(`v:${info.httpVersion}|te:${req.headers.get('transfer-encoding')}|${await req.text()}`),
    });

    try {
        return await fn(`https://127.0.0.1:${server.port}/echo-body`);
    } finally {
        await server.close();
    }
}

function streamOf(chunks, gapMs = 0) {
    const enc = new TextEncoder();

    return new ReadableStream({
        async start(c) {
            for (const chunk of chunks) {
                c.enqueue(enc.encode(chunk));

                if (gapMs) {
                    await new Promise(r => setTimeout(r, gapMs));
                }
            }

            c.close();
        },
    });
}

function send(url, method, body) {
    return fetch(url, {
        method,
        body,
        duplex: 'half',
        allowInsecure: true,
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
}

await withServer(async url => {
    // (a) A few chunks with async gaps between them.
    const r = await send(url, 'POST', streamOf([ 'aaaa', 'bbbb', 'cccc' ], 50));

    assert.eq(r.status, 200);
    assert.eq(await r.text(), 'v:2|te:null|aaaabbbbcccc', 'streamed POST body arrives raw over h2');
});

await withServer(async url => {
    // (b) Larger than the h2 send window (65535 initially, 256 KiB as the lws
    // server sets it): the body must respect the peer's flow control.
    const chunks = [];

    for (let i = 0; i < 96; i++) {
        chunks.push(String.fromCharCode(65 + (i % 26)).repeat(4096));
    }

    const expected = chunks.join('');
    const r = await send(url, 'POST', streamOf(chunks));
    const text = await r.text();
    const prefix = 'v:2|te:null|';

    assert.eq(r.status, 200);
    assert.ok(text.startsWith(prefix), 'large streamed POST went over h2 without Transfer-Encoding');
    assert.eq(text.length - prefix.length, expected.length, 'large streamed POST body length');
    assert.ok(text.slice(prefix.length) === expected, 'large streamed POST body arrives intact');
});

await withServer(async url => {
    // (c) An empty stream still ends the request.
    const r = await send(url, 'POST', streamOf([]));

    assert.eq(r.status, 200);
    assert.eq(await r.text(), 'v:2|te:null|', 'empty streamed POST completes');
});

await withServer(async url => {
    // (d) PUT, which the server also streams without Content-Length on h2.
    const r = await send(url, 'PUT', streamOf([ 'dddd', 'eeee', 'ffff' ], 50));

    assert.eq(r.status, 200);
    assert.eq(await r.text(), 'v:2|te:null|ddddeeeeffff', 'streamed PUT body arrives raw over h2');
});
