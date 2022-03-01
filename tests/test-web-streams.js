import assert from './assert.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

(async () => {
    const listener = await tjs.listen('tcp', '127.0.0.1');
    const addr = listener.localAddress;

    (async () => {
        const conn = await listener.accept();
        await conn.readable.pipeTo(conn.writable);
        listener.close();
    })();
    
    const conn = await tjs.connect('tcp', addr.ip, addr.port);
    const reader = conn.readable.getReader();
    const writer = conn.writable.getWriter();
    const data = encoder.encode('Hello World');
    await writer.write(data);
    const { value, done } = await reader.read();
    assert.eq(done, false),
    assert.eq(decoder.decode(value), 'Hello World');
    await reader.cancel();
})();
