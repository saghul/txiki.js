import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();


async function doEchoServer(server) {
    const conn = await server.accept();

    if (!conn) {
        return;
    }

    await conn.readable.pipeTo(conn.writable);
}

const server = await tjs.listen('tcp', '0.0.0.0');

doEchoServer(server);

const serverAddr = server.localAddress;
const client = await tjs.connect('tcp', serverAddr.ip, serverAddr.port);
client.setKeepAlive(true, 30);
client.setNoDelay(true);
const reader = client.readable.getReader();
const writer = client.writable.getWriter();
await writer.write(encoder.encode('PING'));
let { value, done } = await reader.read();
let dataStr = decoder.decode(value);
assert.eq(dataStr, "PING", "sending works");
assert.throws(() => { client.write("PING"); }, TypeError, "sending anything else gives TypeError");
assert.throws(() => { client.write(1234); }, TypeError, "sending anything else gives TypeError");
await reader.cancel();
server.close();

const server1 = await tjs.listen('tcp', '127.0.0.1');
doEchoServer(server1);
server1.close();
