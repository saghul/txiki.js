import assert from 'tjs:assert';

// Abstract sockets are a Linux only thing.

if (navigator.userAgentData.platform === 'Linux') {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const pipeName = '\0testPipe';

    async function doEchoServer(server) {
        const conn = await server.accept();

        if (!conn) {
            return;
        }

        await conn.readable.pipeTo(conn.writable);
    }

    const server = await tjs.listen('pipe', pipeName);

    doEchoServer(server);

    const client = await tjs.connect('pipe', server.localAddress);

    const reader = client.readable.getReader();
    const writer = client.writable.getWriter();
    await writer.write(encoder.encode('PING'));
    const { value } = await reader.read();
    assert.eq(decoder.decode(value), "PING", "sending works");
    await reader.cancel();
    server.close();
}
