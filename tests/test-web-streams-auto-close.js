import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const server = new TCPServerSocket('127.0.0.1');
const { readable: serverReadable, localAddress, localPort } = await server.opened;

(async () => {
    const reader = serverReadable.getReader();
    const { value: conn } = await reader.read();
    const { readable, writable } = await conn.opened;
    await readable.pipeTo(writable);
    server.close();
})();

const client = new TCPSocket(localAddress, localPort);
const { readable, writable } = await client.opened;
const writer = writable.getWriter();
const reader = readable.getReader();

await writer.write(encoder.encode('HELLO'));
const { value } = await reader.read();
assert.eq(decoder.decode(value), 'HELLO');

// Close writer → server echoes EOF → reader gets EOF.
await writer.close();
const { done } = await reader.read();
assert.eq(done, true);

// closed should auto-resolve without calling client.close().
await client.closed;
await server.closed;
