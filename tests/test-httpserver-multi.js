import assert from 'tjs:assert';

const encoder = new TextEncoder();


// Multiple servers on different ports.
async function testMultipleServers() {
    const server1 = tjs.serve({
        port: 0,
        fetch: () => new Response('server1'),
    });

    const server2 = tjs.serve({
        port: 0,
        fetch: () => new Response('server2'),
    });

    const server3 = tjs.serve({
        port: 0,
        fetch: () => new Response(new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode('server3-stream'));
                controller.close();
            },
        })),
    });

    assert.notEq(server1.port, server2.port, 'ports are different (1 vs 2)');
    assert.notEq(server2.port, server3.port, 'ports are different (2 vs 3)');
    assert.notEq(server1.port, server3.port, 'ports are different (1 vs 3)');

    const [r1, r2, r3] = await Promise.all([
        fetch(`http://127.0.0.1:${server1.port}/`).then(r => r.text()),
        fetch(`http://127.0.0.1:${server2.port}/`).then(r => r.text()),
        fetch(`http://127.0.0.1:${server3.port}/`).then(r => r.text()),
    ]);

    assert.eq(r1, 'server1', 'server1 response');
    assert.eq(r2, 'server2', 'server2 response');
    assert.eq(r3, 'server3-stream', 'server3 streaming response');

    server1.close();
    server2.close();
    server3.close();
}

// Multiple servers with mixed buffered and streaming, interleaved requests.
async function testMultipleServersMixed() {
    const serverBuffered = tjs.serve({
        port: 0,
        fetch: (req) => {
            const url = new URL(req.url);

            return new Response(`buffered:${url.pathname}`);
        },
    });

    const serverStreaming = tjs.serve({
        port: 0,
        fetch: (req) => {
            const url = new URL(req.url);

            return new Response(new ReadableStream({
                async start(controller) {
                    controller.enqueue(encoder.encode(`stream:${url.pathname}:`));
                    await new Promise(r => setTimeout(r, 10));
                    controller.enqueue(encoder.encode('done'));
                    controller.close();
                },
            }));
        },
    });

    const results = await Promise.all([
        fetch(`http://127.0.0.1:${serverBuffered.port}/a`).then(r => r.text()),
        fetch(`http://127.0.0.1:${serverStreaming.port}/x`).then(r => r.text()),
        fetch(`http://127.0.0.1:${serverBuffered.port}/b`).then(r => r.text()),
        fetch(`http://127.0.0.1:${serverStreaming.port}/y`).then(r => r.text()),
    ]);

    assert.eq(results[0], 'buffered:/a', 'buffered /a');
    assert.eq(results[1], 'stream:/x:done', 'streaming /x');
    assert.eq(results[2], 'buffered:/b', 'buffered /b');
    assert.eq(results[3], 'stream:/y:done', 'streaming /y');

    serverBuffered.close();
    serverStreaming.close();
}

// Multiple concurrent requests to a single server.
async function testConcurrentRequests() {
    let requestCount = 0;
    const server = tjs.serve({
        port: 0,
        fetch: () => {
            requestCount++;

            return new Response(`request ${requestCount}`);
        },
    });

    const promises = [];

    for (let i = 0; i < 5; i++) {
        promises.push(fetch(`http://127.0.0.1:${server.port}/`).then(r => r.text()));
    }

    const results = await Promise.all(promises);
    assert.eq(results.length, 5, 'got 5 responses');

    const unique = new Set(results);
    assert.eq(unique.size, 5, 'all responses unique');

    server.close();
}

await testMultipleServers();
await testMultipleServersMixed();
await testConcurrentRequests();
