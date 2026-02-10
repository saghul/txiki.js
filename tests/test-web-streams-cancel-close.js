import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const server = new TCPServerSocket('127.0.0.1');
const { readable: serverReadable, localAddress, localPort } = await server.opened;

const serverDone = (async () => {
    const reader = serverReadable.getReader();
    const { value: conn } = await reader.read();
    const { readable, writable } = await conn.opened;
    try {
        await readable.pipeTo(writable);
    } catch {
        // Client side cancelled, pipeTo may error.
    }
    await conn.closed;
})();

const client = new TCPSocket(localAddress, localPort);
const { readable, writable } = await client.opened;
const writer = writable.getWriter();
const reader = readable.getReader();

await writer.write(encoder.encode('DATA'));
const { value } = await reader.read();
assert.eq(decoder.decode(value), 'DATA');

// Cancel readable first.
await reader.cancel();

// Then close writable.
await writer.close();

// closed should auto-resolve.
await client.closed;
await serverDone;
server.close();
await server.closed;
