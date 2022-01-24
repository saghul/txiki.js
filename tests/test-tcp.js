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
    const server = new tjs.TCP();
    server.bind({ ip: '127.0.0.1' });
    server.listen();
    doEchoServer(server);

    const readBuf = new Uint8Array(4096);
    const client = new tjs.TCP();
    await client.connect(server.getsockname());
    client.write(encoder.encode('PING'));
    let dataStr, nread;
    nread = await client.read(readBuf);
    dataStr = decoer.decode(readBuf.subarray(0, nread));
    assert.eq(dataStr, "PING", "sending works");
    assert.throws(() => { client.write("PING"); }, TypeError, "sending anything else gives TypeError");
    assert.throws(() => { client.write(1234); }, TypeError, "sending anything else gives TypeError");
    client.close();
    server.close();

    const server1 = new tjs.TCP();
    server1.bind({ ip: '127.0.0.1' });
    server1.listen();
    doEchoServer(server1);
    server1.close();
})();
