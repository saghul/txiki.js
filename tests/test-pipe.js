import assert from './assert.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();


async function doEchoServer(server) {
    const conn = await server.accept();
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
    const server = new tjs.Pipe();
    server.bind('testPipe');
    server.listen();
    doEchoServer(server);

    const client = new tjs.Pipe();
    await client.connect(server.getsockname());
    client.write(encoder.encode('PING'));
    const buf = new Uint8Array(4096);
    let dataStr, nread;
    nread = await client.read(buf);
    dataStr = decoder.decode(buf.subarray(0, nread));
    assert.eq(dataStr, "PING", "sending works");
    assert.throws(() => { client.write('PING'); }, TypeError, "sending anything else gives TypeError");
    assert.throws(() => { client.write(1234); }, TypeError, "sending anything else gives TypeError");
    client.close();
    server.close();
})();
