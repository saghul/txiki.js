import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();


async function doEchoServer(serverReadable) {
    const reader = serverReadable.getReader();
    const { value: conn } = await reader.read();

    if (!conn) {
        return;
    }

    const { readable, writable } = await conn.opened;

    await readable.pipeTo(writable);
}

const server = new TCPServerSocket('0.0.0.0');
const { readable: serverReadable, localAddress, localPort } = await server.opened;

doEchoServer(serverReadable);

const client = new TCPSocket(localAddress, localPort, { keepAliveDelay: 30000, noDelay: true });
const { readable, writable } = await client.opened;
const writer = writable.getWriter();
const reader = readable.getReader();
await writer.write(encoder.encode('PING'));
let { value, done } = await reader.read();
let dataStr = decoder.decode(value);
assert.eq(dataStr, "PING", "sending works");

await writer.close();
const eof = await reader.read();
assert.eq(eof.done, true);

client.close();
server.close();

const server1 = new TCPServerSocket('127.0.0.1');
const { readable: serverReadable1 } = await server1.opened;
doEchoServer(serverReadable1);
server1.close();
