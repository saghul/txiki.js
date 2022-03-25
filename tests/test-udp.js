import assert from './assert.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();


async function doEchoServer(server) {
    const dataBuf = new Uint8Array(1024);
    let rinfo;
    while (true) {
        rinfo = await server.recv(dataBuf);
        if (rinfo.nread !== null) {
            assert.ok(typeof rinfo.partial === 'boolean');
            assert.is(rinfo.partial, false);
            server.send(dataBuf.subarray(0, rinfo.nread), rinfo.addr);
        } else {
            // Handle closed!
            break;
        }
    }
}

(async () => {
    const server = await tjs.listen('udp', '127.0.0.1');

    doEchoServer(server);

    const rcvBuf = new Uint8Array(1024);
    const serverAddr = server.localAddress;
    const client = await tjs.listen('udp');
    client.send(encoder.encode('PING'), serverAddr);
    let rinfo, dataStr;
    rinfo = await client.recv(rcvBuf);
    dataStr = decoder.decode(rcvBuf.subarray(0, rinfo.nread));
    assert.eq(dataStr, 'PING', 'sending works');
    assert.eq(serverAddr, rinfo.addr, "source address matches");
    assert.throws(() => { client.send('PING', serverAddr); }, TypeError, "sending anything else gives TypeError");
    assert.throws(() => { client.send(1234, serverAddr); }, TypeError, "sending anything else gives TypeError");
    client.close();
    server.close();
})();
