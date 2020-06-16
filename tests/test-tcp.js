import assert from './assert.js';


async function doEchoServer(server) {
    const conn = await server.accept();
    let data;
    while (true) {
        data = await conn.read();
        if (!data) {
            break;
        }
        conn.write(data);
    }
}

(async () => {
    const server = new tjs.TCP();
    server.bind({ ip: '127.0.0.1' });
    server.listen();
    doEchoServer(server);

    const client = new tjs.TCP();
    await client.connect(server.getsockname());
    client.write("PING");
    let data, dataStr;
    data = await client.read();
    dataStr = new TextDecoder().decode(data);
    assert.eq(dataStr, "PING", "sending strings works");
    client.write(data);
    data = await client.read();
    dataStr = new TextDecoder().decode(data);
    assert.eq(dataStr, "PING", "sending a Uint8Array works");
    assert.throws(() => { client.write(1234); }, TypeError, "sending anything else gives TypeError");
    client.close();
    server.close();
})();
