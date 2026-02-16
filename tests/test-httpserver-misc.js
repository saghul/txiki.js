import assert from 'tjs:assert';

const encoder = new TextEncoder();


// Routing based on URL path with mixed response types.
async function testRouting() {
    const server = tjs.serve({
        port: 0,
        fetch: (req) => {
            const url = new URL(req.url);

            if (url.pathname === '/stream') {
                return new Response(new ReadableStream({
                    start(controller) {
                        controller.enqueue(encoder.encode('streamed'));
                        controller.close();
                    },
                }));
            }

            return new Response(`path: ${url.pathname}`);
        },
    });

    const r1 = await fetch(`http://127.0.0.1:${server.port}/hello`);
    assert.eq(await r1.text(), 'path: /hello', 'buffered path');

    const r2 = await fetch(`http://127.0.0.1:${server.port}/stream`);
    assert.eq(await r2.text(), 'streamed', 'streaming path');

    server.close();
}

// Server close: fetch works before, fails after.
async function testServerClose() {
    const server = tjs.serve({
        port: 0,
        fetch: () => new Response('ok'),
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/`);
    assert.eq(await resp.text(), 'ok', 'response before close');

    server.close();

    let fetchFailed = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 500);

    try {
        await fetch(`http://127.0.0.1:${server.port}/`, { signal: controller.signal });
    } catch {
        fetchFailed = true;
    }

    clearTimeout(timeout);
    assert.ok(fetchFailed, 'fetch fails after close');
}

// Handler returning non-Response falls back to 500.
async function testNonResponseHandler() {
    const server = tjs.serve({
        port: 0,
        fetch: () => 'not a response',
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/`);
    assert.eq(resp.status, 500, 'status is 500');

    server.close();
}

// Handler throwing error returns 500.
async function testErrorHandler() {
    const server = tjs.serve({
        port: 0,
        fetch: () => {
            throw new Error('handler error');
        },
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/`);
    assert.eq(resp.status, 500, 'status is 500');

    const text = await resp.text();
    assert.eq(text, 'Internal Server Error', 'body is error message');

    server.close();
}

// Async handler with delay.
async function testAsyncHandler() {
    const server = tjs.serve({
        port: 0,
        fetch: async () => {
            await new Promise(r => setTimeout(r, 10));

            return new Response('async result');
        },
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/`);
    assert.eq(await resp.text(), 'async result', 'body matches');

    server.close();
}

// Request method and URL pathname are correct.
async function testRequestInfo() {
    const server = tjs.serve({
        port: 0,
        fetch: (req) => {
            const url = new URL(req.url);

            return new Response(JSON.stringify({
                method: req.method,
                pathname: url.pathname,
            }), {
                headers: { 'content-type': 'application/json' },
            });
        },
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/test/path`, {
        method: 'PUT',
    });
    const info = await resp.json();
    assert.eq(info.method, 'PUT', 'method is PUT');
    assert.eq(info.pathname, '/test/path', 'pathname matches');

    server.close();
}

await testRouting();
await testServerClose();
await testNonResponseHandler();
await testErrorHandler();
await testAsyncHandler();
await testRequestInfo();
