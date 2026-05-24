import assert from 'tjs:assert';

const server = await tjs.listen('tcp', '127.0.0.1', 0);
const { readable: serverReadable, localPort } = await server.opened;
const acceptReader = serverReadable.getReader();

// Server-side: just accept connections; drop them when client closes.
async function acceptOne() {
    const { value: conn } = await acceptReader.read();

    if (conn) {
        // Drain so the connection stays alive until the client disconnects.
        const { readable } = await conn.opened;
        const r = readable.getReader();

        r.read().catch(() => {});
    }
}

// 1) `await using` disposes on scope exit and resolves `closed`.
acceptOne();
let socketRef;
{
    await using socket = await tjs.connect('tcp', '127.0.0.1', localPort);

    socketRef = socket;
    assert.ok(socket instanceof TCPSocket, 'is a TCPSocket');
}

// After dispose, the closed promise must already be resolved.
await socketRef.closed;

// 2) Idempotency: manual close + dispose must not throw.
acceptOne();
{
    const socket = await tjs.connect('tcp', '127.0.0.1', localPort);

    socket.close();
    await socket.closed;
    await socket[Symbol.asyncDispose]();
    // Second dispose is also a no-op.
    await socket[Symbol.asyncDispose]();
}

// 3) Two disposes in a row must not throw.
acceptOne();
{
    const socket = await tjs.connect('tcp', '127.0.0.1', localPort);

    await socket[Symbol.asyncDispose]();
    await socket[Symbol.asyncDispose]();
}

// 4) Symbol.asyncDispose lives on the base class prototype (non-enumerable).
const baseProto = Object.getPrototypeOf(Object.getPrototypeOf(socketRef));
const desc = Object.getOwnPropertyDescriptor(baseProto, Symbol.asyncDispose);

assert.ok(desc, 'Symbol.asyncDispose is defined on base prototype');
assert.eq(desc.enumerable, false, 'Symbol.asyncDispose is non-enumerable');
assert.eq(typeof desc.value, 'function', 'Symbol.asyncDispose is a function');

server.close();

