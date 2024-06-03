import assert from 'tjs:assert';

// Abstract sockets are a Linux only thing.

if (tjs.platform === 'linux') {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const pipeName = '\0testPipe';

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

    const server = await tjs.listen('pipe', pipeName);

    doEchoServer(server);

    const client = await tjs.connect('pipe', server.localAddress);

    client.write(encoder.encode('PING'));
    const buf = new Uint8Array(4096);
    const nread = await client.read(buf);
    assert.eq(decoder.decode(buf.subarray(0, nread)), "PING", "sending works");
    client.close();
    server.close();
}
