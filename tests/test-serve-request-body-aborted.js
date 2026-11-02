import assert from 'tjs:assert';

// A chunked request body that lws cuts off (client gone, bad framing) must
// error the handler's body stream: resolving it would pass a truncated body
// off as the whole one.

let outcome;
const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    fetch: async req => {
        try {
            outcome.resolve(`resolved ${JSON.stringify(await req.text())}`);
        } catch (e) {
            outcome.resolve(`rejected ${e.name}`);
        }

        return new Response('ok');
    },
});

async function send(body, closeAfter) {
    outcome = Promise.withResolvers();

    const conn = await tjs.connect('tcp', '127.0.0.1', server.port);
    const { readable, writable } = await conn.opened;
    const writer = writable.getWriter();
    const head = 'POST / HTTP/1.1\r\nHost: 127.0.0.1\r\nTransfer-Encoding: chunked\r\n\r\n';

    await writer.write(new TextEncoder().encode(head + body));

    if (closeAfter) {
        await new Promise(resolve => setTimeout(resolve, 100));
    } else {
        // Wait for lws to answer or drop the connection.
        const reader = readable.getReader();
        const drain = (async () => {
            while (!(await reader.read()).done) {
                // Drain.
            }
        })().catch(() => {});

        await Promise.race([ drain, new Promise(resolve => setTimeout(resolve, 2000)) ]);
    }

    conn.close();

    // lws may also reject the request before the handler ever runs.
    const notInvoked = new Promise(resolve => setTimeout(() => resolve('not invoked'), 1000));

    return Promise.race([ outcome.promise, notInvoked ]);
}

try {
    assert.eq(await send('5\r\nhello\r\n0\r\n\r\n'), 'resolved "hello"', 'a complete body resolves');

    for (const [ name, body, closeAfter ] of [
        [ 'client disconnect mid-body', '5\r\nhello\r\n', true ],
        [ 'bad chunk size', 'zz\r\n', false ],
        [ 'missing chunk CRLF', '5\r\nhelloXX5\r\nworld\r\n0\r\n\r\n', false ],
    ]) {
        const result = await send(body, closeAfter);

        assert.ok(!result.startsWith('resolved'), `${name}: body must not resolve, got ${result}`);
    }
} finally {
    await server.close();
}
