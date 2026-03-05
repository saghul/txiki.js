import assert from 'tjs:assert';


// WS server that echoes back the request headers it received.
const server = tjs.serve({
    port: 0,
    fetch(req, { server }) {
        if (server.upgrade(req, { data: Object.fromEntries(req.headers) })) {
            return;
        }

        return new Response('not ws');
    },
    websocket: {
        message(ws) {
            ws.sendText(JSON.stringify(ws.data));
        },
    },
});

function getHeaders(ws) {
    return new Promise((resolve, reject) => {
        ws.onopen = () => ws.send('ping');
        ws.onmessage = (e) => {
            resolve(JSON.parse(e.data));
            ws.close();
        };
        ws.onerror = () => reject(new Error('ws error'));
    });
}

// Test 1: WebSocket with custom headers (object form).
{
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`, {
        headers: {
            'Authorization': 'Bearer test-token',
            'X-Custom-Header': 'custom-value',
        },
    });

    const headers = await getHeaders(ws);

    assert.eq(headers['authorization'], 'Bearer test-token', 'Authorization header received');
    assert.eq(headers['x-custom-header'], 'custom-value', 'X-Custom-Header received');
}

// Test 2: WebSocket with custom headers + protocols (empty, for compat).
{
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`, {
        headers: { 'X-Test': 'hello' },
        protocols: [],
    });

    const headers = await getHeaders(ws);

    assert.eq(headers['x-test'], 'hello', 'custom header with protocols option');
}

// Test 3: WebSocket with Headers instance.
{
    const h = new Headers();

    h.set('X-From-Headers', 'instance-value');

    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`, {
        headers: h,
    });

    const headers = await getHeaders(ws);

    assert.eq(headers['x-from-headers'], 'instance-value', 'Headers instance works');
}

// Test 4: Backward compatibility — array of protocols still works (empty).
{
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`, []);

    const headers = await getHeaders(ws);

    assert.ok(headers, 'array protocols still works');
}

// Test 5: Backward compatibility — no second argument.
{
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);

    const headers = await getHeaders(ws);

    assert.ok(headers, 'no second argument still works');
}

// Test 6: Forbidden headers throw.
{
    const forbidden = [
        'Connection', 'Upgrade', 'Host',
        'Sec-WebSocket-Key', 'Sec-WebSocket-Version',
        'Sec-WebSocket-Protocol', 'Sec-WebSocket-Accept',
        'Sec-WebSocket-Extensions',
    ];

    for (const name of forbidden) {
        assert.throws(() => {
            new WebSocket(`ws://127.0.0.1:${server.port}`, {
                headers: { [name]: 'value' },
            });
        }, TypeError, `forbidden header ${name} should throw`);
    }
}

// Test 7: Invalid header name/value throw.
{
    assert.throws(() => {
        new WebSocket(`ws://127.0.0.1:${server.port}`, {
            headers: { '': 'value' },
        });
    }, TypeError, 'empty header name throws');

    assert.throws(() => {
        new WebSocket(`ws://127.0.0.1:${server.port}`, {
            headers: { 'X-Test': 'val\x00ue' },
        });
    }, TypeError, 'null byte in value throws');
}

// Test 8: WebSocketStream with custom headers.
{
    const wss = new WebSocketStream(`ws://127.0.0.1:${server.port}`, {
        headers: { 'X-Stream-Header': 'stream-value' },
    });

    const { readable, writable } = await wss.opened;

    const writer = writable.getWriter();

    await writer.write('ping');

    const reader = readable.getReader();
    const { value } = await reader.read();
    const headers = JSON.parse(value);

    assert.eq(headers['x-stream-header'], 'stream-value', 'WebSocketStream headers work');

    writer.releaseLock();
    reader.releaseLock();
    wss.close();

    await wss.closed;
}

server.close();
