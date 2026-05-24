import assert from 'tjs:assert';

// Calling close() twice on a server-style socket must be safe: no throw,
// no asynchronous "stream is not in a state that permits close" error
// from a re-fired C onconnection callback.

// 1) TCPServerSocket
{
    const server = await tjs.listen('tcp', '127.0.0.1', 0);

    await server.opened;
    server.close();
    server.close();
    await server.closed;
}

// 2) PipeServerSocket
{
    let pipeName;

    if (navigator.userAgentData.platform === 'Windows') {
        pipeName = '\\\\?\\pipe\\test-server-double-close';
    } else {
        pipeName = 'test-server-double-close';
    }

    const server = await tjs.listen('pipe', pipeName);

    await server.opened;
    server.close();
    server.close();
    await server.closed;
}

// 3) UDPSocket
{
    const sock = await tjs.listen('udp', '127.0.0.1', 0);

    await sock.opened;
    sock.close();
    sock.close();
    await sock.closed;
}

// 4) TCPServerSocket: close() interleaved with accept stream consumption.
//    Consuming the accept reader after close must show done:true once and
//    a second close() must still be a silent no-op.
{
    const server = await tjs.listen('tcp', '127.0.0.1', 0);
    const { readable } = await server.opened;
    const reader = readable.getReader();

    server.close();

    const r1 = await reader.read();

    assert.eq(r1.done, true, 'accept reader is done after close');

    // Second close must not throw and must not trigger any stream error.
    server.close();
    await server.closed;
}

// 5) Bare new without listen() succeeds-or-throws path: close() twice is safe.
{
    const server = new TCPServerSocket('127.0.0.1');

    await server.opened;
    server.close();
    server.close();
    await server.closed;
}
