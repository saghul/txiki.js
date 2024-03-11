import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();


async function doEchoServer(server) {
    const conn = await server.accept();

    if (!conn) {
        return;
    }

    const buf = new Uint8Array(4096);
    while (true) {
        const nread = await conn.read(buf);
        if (nread === null) {
            break;
        }
        conn.write(buf.slice(0, nread));
    }
}

const server = await tjs.listen('tcp', '0.0.0.0');

doEchoServer(server);

const readBuf = new Uint8Array(4096);

const serverAddr = server.localAddress;
const client = await tjs.connect('tcp', serverAddr.ip, serverAddr.port);
client.setKeepAlive(true, 30);
client.setNoDelay(true);
client.write(encoder.encode('PING'));
let dataStr, nread;
nread = await client.read(readBuf);
dataStr = decoder.decode(readBuf.subarray(0, nread));
assert.eq(dataStr, "PING", "sending works");
assert.throws(() => { client.write("PING"); }, TypeError, "sending anything else gives TypeError");
assert.throws(() => { client.write(1234); }, TypeError, "sending anything else gives TypeError");
client.close();
server.close();

const server1 = await tjs.listen('tcp', '127.0.0.1');
doEchoServer(server1);
server1.close();
