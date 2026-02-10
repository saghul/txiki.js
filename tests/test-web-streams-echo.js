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
const data = encoder.encode('Hello World');
await writer.write(data);
const { value, done } = await reader.read();
assert.eq(done, false);
assert.eq(decoder.decode(value), 'Hello World');

await writer.close();
const eof = await reader.read();
assert.eq(eof.done, true);

client.close();
await server.closed;
