import assert from './assert.js';

const encoder = new TextEncoder();
const decoer = new TextDecoder();


async function doEchoServer(server) {
    const conn = await server.accept();

    if (!conn) {
        return;
    }

    const buf = new Uint8Array(4096);
    while (true) {
        const nread = await conn.read(buf);
        if (!nread) {
            break;
        }
        conn.write(buf.slice(0, nread));
    }
}

(async () => {
    const server = await tjs.listen('tcp', '127.0.0.1');

    doEchoServer(server);

    const readBuf = new Uint8Array(4096);

    const serverAddr = server.localAddress;
    const client = await tjs.connect('tcp', serverAddr.ip, serverAddr.port);
    client.write(encoder.encode('PING'));
    let dataStr, nread;
    nread = await client.read(readBuf);
    dataStr = decoer.decode(readBuf.subarray(0, nread));
    assert.eq(dataStr, "PING", "sending works");
    client.close();
    server.close();

    const server1 = await tjs.listen('tcp', '127.0.0.1');
    doEchoServer(server1);
    server1.close();
})();
