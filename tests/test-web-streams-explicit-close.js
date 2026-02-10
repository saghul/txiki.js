import assert from 'tjs:assert';

const server = new TCPServerSocket('127.0.0.1');
const { readable: serverReadable, localAddress, localPort } = await server.opened;

(async () => {
    const reader = serverReadable.getReader();
    const { value: conn } = await reader.read();
    if (conn) {
        const { readable, writable } = await conn.opened;
        try {
            await readable.pipeTo(writable);
        } catch {
            // Ignore.
        }
    }
    server.close();
})();

const client = new TCPSocket(localAddress, localPort);
await client.opened;

client.close();
await client.closed;
await server.closed;
