import assert from 'tjs:assert';

let pipeName;

if (navigator.userAgentData.platform === 'Windows') {
    pipeName = '\\\\?\\pipe\\test-dispose-pipe';
} else {
    pipeName = 'test-dispose-pipe';
}

// 1) `await using` on a PipeServerSocket disposes the listener.
let serverRef;
{
    await using server = await tjs.listen('pipe', pipeName);

    serverRef = server;
    assert.ok(server instanceof PipeServerSocket, 'is a PipeServerSocket');

    const opened = await server.opened;

    assert.eq(typeof opened.localAddress, 'string', 'has a localAddress');
}

await serverRef.closed;

// 2) `await using` on a PipeSocket (client) disposes the connection.
const server2 = await tjs.listen('pipe', pipeName);
const { readable: srvReadable } = await server2.opened;
const acceptReader = srvReadable.getReader();

acceptReader.read().then(({ value: conn }) => {
    if (conn) {
        conn.opened.then(({ readable }) => {
            const r = readable.getReader();

            r.read().catch(() => {});
        });
    }
});

let clientRef;
{
    await using client = await tjs.connect('pipe', pipeName);

    clientRef = client;
    assert.ok(client instanceof PipeSocket, 'is a PipeSocket');
}

await clientRef.closed;

// 3) Idempotency on the client.
{
    const client = await tjs.connect('pipe', pipeName);

    client.close();
    await client.closed;
    await client[Symbol.asyncDispose]();
    await client[Symbol.asyncDispose]();
}

server2.close();
