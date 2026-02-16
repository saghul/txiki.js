import assert from 'tjs:assert';


// Buffered response with string body.
async function testBufferedString() {
    const server = tjs.serve({
        port: 0,
        fetch: () => new Response('hello world'),
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/`);
    assert.eq(resp.status, 200, 'status is 200');

    const text = await resp.text();
    assert.eq(text, 'hello world', 'body matches');

    server.close();
}

// Buffered response with custom status and headers.
async function testBufferedHeaders() {
    const server = tjs.serve({
        port: 0,
        fetch: () => new Response('not found', {
            status: 404,
            headers: { 'x-custom': 'test-value', 'content-type': 'text/plain' },
        }),
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/`);
    assert.eq(resp.status, 404, 'status is 404');
    assert.eq(resp.headers.get('x-custom'), 'test-value', 'custom header');
    assert.eq(resp.headers.get('content-type'), 'text/plain', 'content-type');

    const text = await resp.text();
    assert.eq(text, 'not found', 'body matches');

    server.close();
}

// Buffered response with empty body.
async function testBufferedEmpty() {
    const server = tjs.serve({
        port: 0,
        fetch: () => new Response(null, { status: 204 }),
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/`);
    assert.eq(resp.status, 204, 'status is 204');

    server.close();
}

// Buffered response with JSON body.
async function testBufferedJSON() {
    const data = { message: 'hello', number: 42 };
    const server = tjs.serve({
        port: 0,
        fetch: () => new Response(JSON.stringify(data), {
            headers: { 'content-type': 'application/json' },
        }),
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/`);
    assert.eq(resp.status, 200, 'status is 200');

    const json = await resp.json();
    assert.eq(json.message, 'hello', 'message field');
    assert.eq(json.number, 42, 'number field');

    server.close();
}

// POST request with body echoed back.
async function testPostRequest() {
    const server = tjs.serve({
        port: 0,
        fetch: async (req) => {
            const body = await req.text();

            return new Response(`echo: ${body}`, {
                headers: { 'content-type': 'text/plain' },
            });
        },
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/`, {
        method: 'POST',
        body: 'hello from client',
    });

    const text = await resp.text();
    assert.eq(text, 'echo: hello from client', 'body echoed back');

    server.close();
}

await testBufferedString();
await testBufferedHeaders();
await testBufferedEmpty();
await testBufferedJSON();
await testPostRequest();
