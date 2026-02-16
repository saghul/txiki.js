import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();


// Streaming response with multiple chunks.
async function testStreamingChunks() {
    const server = tjs.serve({
        port: 0,
        fetch: () => new Response(new ReadableStream({
            async start(controller) {
                controller.enqueue(encoder.encode('chunk1\n'));
                await new Promise(r => setTimeout(r, 10));
                controller.enqueue(encoder.encode('chunk2\n'));
                await new Promise(r => setTimeout(r, 10));
                controller.enqueue(encoder.encode('chunk3\n'));
                controller.close();
            },
        })),
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/`);
    assert.eq(resp.status, 200, 'status is 200');

    const text = await resp.text();
    assert.eq(text, 'chunk1\nchunk2\nchunk3\n', 'all chunks received');

    server.close();
}

// Streaming response delivers chunks progressively.
async function testStreamingProgressive() {
    const server = tjs.serve({
        port: 0,
        fetch: () => new Response(new ReadableStream({
            async start(controller) {
                controller.enqueue(encoder.encode('first'));
                await new Promise(r => setTimeout(r, 100));
                controller.enqueue(encoder.encode('second'));
                controller.close();
            },
        })),
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/`);
    const reader = resp.body.getReader();
    const chunks = [];

    while (true) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        chunks.push(decoder.decode(value, { stream: true }));
    }

    assert.ok(chunks.length >= 2, `got ${chunks.length} chunks, expected >= 2`);
    assert.eq(chunks.join(''), 'firstsecond', 'content matches');

    server.close();
}

// Empty streaming response.
async function testStreamingEmpty() {
    const server = tjs.serve({
        port: 0,
        fetch: () => new Response(new ReadableStream({
            start(controller) {
                controller.close();
            },
        })),
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/`);
    const text = await resp.text();
    assert.eq(text, '', 'body is empty');

    server.close();
}

// Streaming response with custom headers (SSE-style).
async function testStreamingHeaders() {
    const server = tjs.serve({
        port: 0,
        fetch: () => new Response(new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode('data: hello\n\n'));
                controller.close();
            },
        }), {
            headers: {
                'content-type': 'text/event-stream',
                'cache-control': 'no-cache',
                'x-stream': 'yes',
            },
        }),
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/`);
    assert.eq(resp.status, 200, 'status is 200');
    assert.eq(resp.headers.get('content-type'), 'text/event-stream', 'content-type');
    assert.eq(resp.headers.get('x-stream'), 'yes', 'custom header');

    const text = await resp.text();
    assert.eq(text, 'data: hello\n\n', 'body matches');

    server.close();
}

// POST request with streaming response.
async function testPostStreaming() {
    const server = tjs.serve({
        port: 0,
        fetch: async (req) => {
            const body = await req.text();

            return new Response(new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(`received: ${body}`));
                    controller.close();
                },
            }));
        },
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/`, {
        method: 'POST',
        body: 'test data',
    });

    const text = await resp.text();
    assert.eq(text, 'received: test data', 'body echoed');

    server.close();
}

// Large streaming response (64KB in 1KB chunks).
async function testStreamingLarge() {
    const chunkSize = 1024;
    const numChunks = 64;
    const server = tjs.serve({
        port: 0,
        fetch: () => new Response(new ReadableStream({
            start(controller) {
                for (let i = 0; i < numChunks; i++) {
                    const chunk = new Uint8Array(chunkSize);
                    chunk.fill(i & 0xff);
                    controller.enqueue(chunk);
                }

                controller.close();
            },
        })),
    });

    const resp = await fetch(`http://127.0.0.1:${server.port}/`);
    const buf = await resp.arrayBuffer();
    const arr = new Uint8Array(buf);
    assert.eq(arr.length, chunkSize * numChunks, 'total size matches');

    for (let i = 0; i < numChunks; i++) {
        const expected = i & 0xff;
        const actual = arr[i * chunkSize];
        assert.eq(actual, expected, `chunk ${i} content matches`);
    }

    server.close();
}

await testStreamingChunks();
await testStreamingProgressive();
await testStreamingEmpty();
await testStreamingHeaders();
await testPostStreaming();
await testStreamingLarge();
