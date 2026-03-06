import assert from 'tjs:assert';

// Local echo server for reliable testing.
const server = tjs.serve({
    port: 0,
    fetch(req, { server }) {
        if (server.upgrade(req)) {
            return;
        }

        return new Response('not a websocket request');
    },
    websocket: {
        message(ws, data) {
            if (typeof data === 'string') {
                ws.sendText(data);
            } else {
                ws.sendBinary(data);
            }
        },
    },
});

const echoUrl = `ws://127.0.0.1:${server.port}`;

// Test: send and receive text messages.
{
    console.log('[TEST] send: text test starting');
    const wss = new WebSocketStream(echoUrl);
    const { readable, writable } = await wss.opened;
    console.log('[TEST] send: opened');

    const writer = writable.getWriter();
    const reader = readable.getReader();

    await writer.write('hello');

    const { value, done } = await reader.read();

    assert.eq(done, false, 'stream is not done');
    assert.eq(value, 'hello', 'received echoed text');

    await writer.write('world');

    const msg2 = await reader.read();

    assert.eq(msg2.value, 'world', 'received second echoed text');

    writer.releaseLock();
    reader.releaseLock();
    wss.close();
    await wss.closed;
    console.log('[TEST] send: text test done');
}

// Test: send and receive binary data.
{
    console.log('[TEST] send: binary test starting');
    const wss = new WebSocketStream(echoUrl);
    const { readable, writable } = await wss.opened;
    console.log('[TEST] send: binary opened');

    const writer = writable.getWriter();
    const reader = readable.getReader();

    const data = new Uint8Array([ 1, 2, 3, 4, 5 ]);

    await writer.write(data);
    console.log('[TEST] send: binary written');

    const { value } = await reader.read();
    console.log('[TEST] send: binary received, type:', value?.constructor?.name, 'instanceof Uint8Array:', value instanceof Uint8Array);

    assert.ok(value instanceof Uint8Array, 'received Uint8Array');
    assert.eq(value.length, data.length, 'received correct length');

    for (let i = 0; i < data.length; i++) {
        assert.eq(value[i], data[i], `byte ${i} matches`);
    }

    writer.releaseLock();
    reader.releaseLock();
    wss.close();
    await wss.closed;
    console.log('[TEST] send: binary test done');
}

server.close();
