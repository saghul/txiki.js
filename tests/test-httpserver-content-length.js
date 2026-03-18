import assert from 'tjs:assert';


// When a handler sets content-length, it should not be duplicated.
async function testUserContentLength() {
    const body = 'hello world';
    const server = tjs.serve({
        port: 0,
        fetch: () => new Response(body, {
            headers: { 'content-length': String(body.length) },
        }),
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/`);
    assert.eq(resp.status, 200, 'status is 200');
    assert.eq(resp.headers.get('content-length'), String(body.length), 'content-length matches');

    const text = await resp.text();
    assert.eq(text, body, 'body matches');

    server.close();
}

// When a handler does not set content-length, it should be auto-added.
async function testAutoContentLength() {
    const body = 'auto length';
    const server = tjs.serve({
        port: 0,
        fetch: () => new Response(body),
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/`);
    assert.eq(resp.status, 200, 'status is 200');
    assert.eq(resp.headers.get('content-length'), String(body.length), 'auto content-length is correct');

    const text = await resp.text();
    assert.eq(text, body, 'body matches');

    server.close();
}

await testUserContentLength();
await testAutoContentLength();
