import assert from 'tjs:assert';


// Idempotency: manual close() followed by disposer is a no-op.
{
    const server = tjs.serve({
        port: 0,
        fetch: () => new Response('ok'),
    });

    await server.close();

    // Should not throw.
    await server[Symbol.asyncDispose]();
}

// Disposer-only path: `await using` closes the server at scope exit so
// subsequent connections are refused.
let port;

{
    await using server = tjs.serve({
        port: 0,
        fetch: () => new Response('ok'),
    });

    port = server.port;
    assert.ok(typeof port === 'number' && port > 0, 'server has a port');

    const resp = await fetch(`http://127.0.0.1:${port}/`);

    assert.eq(await resp.text(), 'ok', 'fetch inside scope ok');
}

let stillUp = true;
const c = new AbortController();
const t = setTimeout(() => c.abort(), 500);

try {
    await fetch(`http://127.0.0.1:${port}/`, { signal: c.signal });
} catch {
    stillUp = false;
}

clearTimeout(t);
assert.ok(!stillUp, 'server stopped accepting after dispose');
