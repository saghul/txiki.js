import assert from 'tjs:assert';

// Abstract sockets are a Linux only thing.

if (navigator.userAgentData.platform === 'Linux') {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const pipeName = '\0testPipe';

    async function doEchoServer(serverReadable) {
        const reader = serverReadable.getReader();
        const { value: conn } = await reader.read();

        if (!conn) {
            return;
        }

        const { readable, writable } = await conn.opened;

        await readable.pipeTo(writable);
    }

    const server = new PipeServerSocket(pipeName);
    const { readable: serverReadable, localAddress } = await server.opened;

    doEchoServer(serverReadable);

    const client = new PipeSocket(localAddress);
    const { readable, writable } = await client.opened;

    const writer = writable.getWriter();
    const reader = readable.getReader();
    await writer.write(encoder.encode('PING'));
    const { value } = await reader.read();
    assert.eq(decoder.decode(value), "PING", "sending works");

    await writer.close();
    const eof = await reader.read();
    assert.eq(eof.done, true);

    client.close();
    server.close();
}
