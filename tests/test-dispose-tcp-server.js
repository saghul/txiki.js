import assert from 'tjs:assert';

// 1) `await using` on a server should make the closed promise resolve after the
//    block ends, and subsequent connect attempts should fail.
let serverRef;
let localPort;
{
    await using server = await tjs.listen('tcp', '127.0.0.1', 0);

    serverRef = server;
    assert.ok(server instanceof TCPServerSocket, 'is a TCPServerSocket');

    const opened = await server.opened;

    localPort = opened.localPort;
    assert.eq(typeof localPort, 'number', 'has a localPort');
    assert.ok(localPort > 0, 'localPort is bound');
}

// After dispose, closed must be resolved.
await serverRef.closed;

// Connecting to the now-closed listener should fail.
let connectError;
try {
    const sock = await tjs.connect('tcp', '127.0.0.1', localPort);

    sock.close();
} catch (e) {
    connectError = e;
}

assert.isNot(connectError, undefined, 'connect after dispose fails');

// 2) Idempotency: manual close + dispose + dispose must not throw.
{
    const server = await tjs.listen('tcp', '127.0.0.1', 0);

    await server.opened;
    server.close();
    await server.closed;
    await server[Symbol.asyncDispose]();
    await server[Symbol.asyncDispose]();
}

// 3) Two disposes in a row must not throw.
{
    const server = await tjs.listen('tcp', '127.0.0.1', 0);

    await server.opened;
    await server[Symbol.asyncDispose]();
    await server[Symbol.asyncDispose]();
}
