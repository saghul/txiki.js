import assert from 'tjs:assert';

// A chunked request body that lws cuts off (client gone, bad framing) must
// error the handler's body stream: resolving it would pass a truncated body
// off as the whole one, and never settling it would hang the handler.

let invoked;
let started;
let outcome;
const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    fetch: async req => {
        invoked = true;
        started.resolve();

        try {
            outcome.resolve(`resolved ${JSON.stringify(await req.text())}`);
        } catch (e) {
            outcome.resolve(`rejected ${e.name}`);
        }

        return new Response('ok');
    },
});

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function send(body, closeAfter) {
    invoked = false;
    started = Promise.withResolvers();
    outcome = Promise.withResolvers();

    const conn = await tjs.connect('tcp', '127.0.0.1', server.port);
    const { readable, writable } = await conn.opened;
    const writer = writable.getWriter();
    const head = 'POST / HTTP/1.1\r\nHost: 127.0.0.1\r\nTransfer-Encoding: chunked\r\n\r\n';

    await writer.write(new TextEncoder().encode(head + body));

    if (closeAfter) {
        // Disconnect only once the handler has its body stream; a fixed
        // delay loses that race on slow (GC stress) builds.
        let timer;

        await Promise.race([ started.promise, new Promise(resolve => {
            timer = setTimeout(resolve, 10000);
        }) ]);
        clearTimeout(timer);
    } else {
        // Wait for lws to answer or drop the connection.
        const reader = readable.getReader();
        const drain = (async () => {
            while (!(await reader.read()).done) {
                // Drain.
            }
        })().catch(() => {});

        await Promise.race([ drain, delay(2000) ]);
    }

    conn.close();

    // lws may also reject the request before the handler ever runs. Once it
    // ran, its body must settle: a lost rejection would look like a hang.
    if (!invoked) {
        return 'not invoked';
    }

    let timer;
    const timeout = new Promise(resolve => {
        timer = setTimeout(() => resolve('body never settled'), 3000);
    });
    const result = await Promise.race([ outcome.promise, timeout ]);

    clearTimeout(timer);

    return result;
}

try {
    assert.eq(await send('5\r\nhello\r\n0\r\n\r\n'), 'resolved "hello"', 'a complete body resolves');
    assert.eq(await send('5\r\nhello\r\n', true), 'rejected TypeError', 'client disconnect mid-body rejects');

    for (const [ name, body ] of [
        [ 'bad chunk size', 'zz\r\n' ],
        [ 'missing chunk CRLF', '5\r\nhelloXX5\r\nworld\r\n0\r\n\r\n' ],
    ]) {
        const result = await send(body, false);

        assert.ok([ 'rejected TypeError', 'not invoked' ].includes(result), `${name}: body must reject, got ${result}`);
    }
} finally {
    await server.close();
}
