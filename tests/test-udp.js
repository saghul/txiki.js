import assert from './assert.js';


async function doEchoServer(server) {
    let rinfo;
    while (true) {
        rinfo = await server.recv();
        if (rinfo.data) {
            server.send(rinfo.data, rinfo.addr);
        } else {
            // Handle closed!
            break;
        }
    }
}

(async () => {
    const server = new tjs.UDP();
    server.bind({ ip: '127.0.0.1' });
    doEchoServer(server);

    const serverAddr = server.getsockname();
    const client = new tjs.UDP();
    client.send("PING", serverAddr);
    let rinfo, dataStr;
    rinfo = await client.recv();
    dataStr = new TextDecoder().decode(rinfo.data);
    assert.eq(dataStr, "PING", "sending strings works");
    assert.eq(serverAddr, rinfo.addr, "source address matches");
    client.send(rinfo.data, serverAddr);
    rinfo = await client.recv();
    dataStr = new TextDecoder().decode(rinfo.data);
    assert.eq(dataStr, "PING", "sending a Uint8Array works");
    assert.throws(() => { client.send(1234, serverAddr); }, TypeError, "sending anything else gives TypeError");
    client.close();
    server.close();
})();
