import assert from 'tjs:assert';

const longCookie = 'a='.padEnd(5000, 'x');
const longCustom = 'v='.padEnd(8000, 'y');

// Client sends large headers to a local server and the server echoes them back.
async function testLargeRequestHeaders() {
    const server = tjs.serve({
        port: 0,
        fetch: (req) => {
            return new Response(JSON.stringify({
                cookie: req.headers.get('cookie'),
                custom: req.headers.get('x-large-header'),
            }), {
                headers: { 'content-type': 'application/json' },
            });
        },
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/`, {
        headers: {
            'Cookie': longCookie,
            'X-Large-Header': longCustom,
        },
    });

    assert.eq(resp.status, 200, 'status is 200');

    const data = await resp.json();
    assert.eq(data.cookie, longCookie, 'large cookie header preserved');
    assert.eq(data.custom, longCustom, 'large custom header preserved');

    server.close();
}

// Server sends large response headers back to the client.
async function testLargeResponseHeaders() {
    const server = tjs.serve({
        port: 0,
        fetch: () => {
            return new Response('ok', {
                headers: {
                    'X-Large-Response': longCustom,
                    'Set-Cookie': longCookie,
                },
            });
        },
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/`);
    assert.eq(resp.status, 200, 'status is 200');
    assert.eq(resp.headers.get('x-large-response'), longCustom, 'large response header preserved');
    assert.eq(resp.headers.get('set-cookie'), longCookie, 'large set-cookie header preserved');
    assert.eq(await resp.text(), 'ok', 'body is readable');

    server.close();
}

await testLargeRequestHeaders();
await testLargeResponseHeaders();
