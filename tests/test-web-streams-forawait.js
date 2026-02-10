import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const server = new TCPServerSocket('127.0.0.1');
const { readable: serverReadable, localAddress, localPort } = await server.opened;

(async () => {
    for await (const conn of serverReadable) {
        const { readable, writable } = await conn.opened;
        await readable.pipeTo(writable);
    }
})();

const client = new TCPSocket(localAddress, localPort);
const { readable, writable } = await client.opened;
const writer = writable.getWriter();
const reader = readable.getReader();

await writer.write(encoder.encode('PING'));
const { value } = await reader.read();
assert.eq(decoder.decode(value), 'PING');

await writer.close();
const { done } = await reader.read();
assert.eq(done, true);

client.close();
server.close();
await server.closed;
