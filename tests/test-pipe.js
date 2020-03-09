import { run, test } from './t.js';


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

test('basic Pipe ops work', async t => {
    const server = new tjs.Pipe();
    server.bind('testPipe');
    server.listen();
    doEchoServer(server);

    const client = new tjs.Pipe();
    await client.connect(server.getsockname());
    client.write("PING");
    let data, dataStr;
    data = await client.read();
    dataStr = new TextDecoder().decode(data);
    t.eq(dataStr, "PING", "sending strings works");
    client.write(data);
    data = await client.read();
    dataStr = new TextDecoder().decode(data);
    t.eq(dataStr, "PING", "sending a Uint8Array works");
    t.throws(() => { client.write(1234); }, TypeError, "sending anything else gives TypeError");
    client.close();
    server.close();
});


if (import.meta.main) {
    run();
}
