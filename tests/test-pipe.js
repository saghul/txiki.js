import assert from './assert.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let pipeName;
if (tjs.platform === 'windows') {
    pipeName = '\\\\?\\pipe\\testPipe';
} else {
    pipeName = 'testPipe';
}

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
    const server = await tjs.listen('pipe', pipeName);

    doEchoServer(server);

    const client = await tjs.connect('pipe', server.localAddress);

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

    let error;
    try {
        await tjs.listen('pipe');
    } catch (e) {
        error = e;
    }
    assert.isNot(error, undefined);
    assert.eq(error.name, 'TypeError');

    error = undefined;

    try {
        await tjs.connect('pipe');
    } catch (e) {
        error = e;
    }
    assert.isNot(error, undefined);
    assert.eq(error.name, 'TypeError');
})();
