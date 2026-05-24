import assert from 'tjs:assert';

// 1) `await using` on a UDPSocket created via listen.
let serverRef;
{
    await using server = await tjs.listen('udp', '127.0.0.1', 0);

    serverRef = server;
    assert.ok(server instanceof UDPSocket, 'is a UDPSocket');

    const opened = await server.opened;

    assert.eq(typeof opened.localPort, 'number', 'has a localPort');
    assert.ok(opened.localPort > 0, 'localPort is bound');
}

await serverRef.closed;

// 2) `await using` on a connected UDPSocket via tjs.connect.
const server2 = await tjs.listen('udp', '127.0.0.1', 0);
const { localAddress: a2, localPort: p2 } = await server2.opened;

let clientRef;
{
    await using client = await tjs.connect('udp', a2, p2);

    clientRef = client;
    assert.ok(client instanceof UDPSocket, 'is a connected UDPSocket');

    const opened = await client.opened;

    assert.eq(opened.remoteAddress, a2, 'remoteAddress matches');
    assert.eq(opened.remotePort, p2, 'remotePort matches');
}

await clientRef.closed;

// 3) Idempotency: manual close + dispose twice must not throw.
{
    const sock = await tjs.listen('udp', '127.0.0.1', 0);

    await sock.opened;
    sock.close();
    await sock.closed;
    await sock[Symbol.asyncDispose]();
    await sock[Symbol.asyncDispose]();
}

// 4) Two disposes in a row must not throw.
{
    const sock = await tjs.listen('udp', '127.0.0.1', 0);

    await sock.opened;
    await sock[Symbol.asyncDispose]();
    await sock[Symbol.asyncDispose]();
}

// 5) Symbol.asyncDispose is non-enumerable.
const desc = Object.getOwnPropertyDescriptor(UDPSocket.prototype, Symbol.asyncDispose);

assert.ok(desc, 'Symbol.asyncDispose is defined on UDPSocket.prototype');
assert.eq(desc.enumerable, false, 'Symbol.asyncDispose is non-enumerable');
assert.eq(typeof desc.value, 'function', 'Symbol.asyncDispose is a function');

server2.close();
