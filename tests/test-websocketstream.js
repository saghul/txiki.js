import assert from 'tjs:assert';

const echoUrl = 'wss://websocket-echo.com';

// Test: WebSocketError construction.
{
    const err = new WebSocketError('test', { closeCode: 4000, reason: 'bye' });

    assert.ok(err instanceof DOMException, 'WebSocketError is a DOMException');
    assert.eq(err.name, 'WebSocketError', 'name is WebSocketError');
    assert.eq(err.message, 'test', 'message is set');
    assert.eq(err.closeCode, 4000, 'closeCode is set');
    assert.eq(err.reason, 'bye', 'reason is set');

    const errNoCode = new WebSocketError('', { reason: 'auto code' });

    assert.eq(errNoCode.closeCode, 1000, 'closeCode defaults to 1000 when reason is set');

    const errEmpty = new WebSocketError();

    assert.eq(errEmpty.closeCode, null, 'closeCode is null when not set');
    assert.eq(errEmpty.reason, '', 'reason is empty when not set');

    assert.throws(() => new WebSocketError('', { closeCode: 1234 }), DOMException, 'invalid closeCode');
}

// Test: basic open and close.
{
    const wss = new WebSocketStream(echoUrl);

    assert.ok(wss.url.startsWith(echoUrl), 'url is set');
    assert.ok(wss.opened instanceof Promise, 'opened is a Promise');
    assert.ok(wss.closed instanceof Promise, 'closed is a Promise');

    const { readable, writable, protocol } = await wss.opened;

    assert.ok(readable instanceof ReadableStream, 'readable is a ReadableStream');
    assert.ok(writable instanceof WritableStream, 'writable is a WritableStream');
    assert.eq(typeof protocol, 'string', 'protocol is a string');

    wss.close();

    const { closeCode, reason } = await wss.closed;

    assert.eq(closeCode, 1005, 'closeCode is 1005 (no status sent)');
    assert.eq(reason, '', 'reason is empty');
}

// Test: send and receive text messages.
{
    const wss = new WebSocketStream(echoUrl);
    const { readable, writable } = await wss.opened;

    const writer = writable.getWriter();
    const reader = readable.getReader();

    await writer.write('hello');

    const { value, done } = await reader.read();

    assert.eq(done, false, 'stream is not done');
    assert.eq(value, 'hello', 'received echoed text');

    await writer.write('world');

    const msg2 = await reader.read();

    assert.eq(msg2.value, 'world', 'received second echoed text');

    writer.releaseLock();
    reader.releaseLock();
    wss.close();
    await wss.closed;
}

// Test: send and receive binary data.
{
    const wss = new WebSocketStream(echoUrl);
    const { readable, writable } = await wss.opened;

    const writer = writable.getWriter();
    const reader = readable.getReader();
    const data = new Uint8Array([ 1, 2, 3, 4, 5 ]);

    await writer.write(data);

    const { value } = await reader.read();

    assert.ok(value instanceof Uint8Array, 'received Uint8Array');
    assert.eq(value.length, data.length, 'received correct length');

    for (let i = 0; i < data.length; i++) {
        assert.eq(value[i], data[i], `byte ${i} matches`);
    }

    writer.releaseLock();
    reader.releaseLock();
    wss.close();
    await wss.closed;
}

// Test: close with custom code and reason.
{
    const wss = new WebSocketStream(echoUrl);

    await wss.opened;

    wss.close({ closeCode: 4000, reason: 'custom close' });

    const { closeCode, reason } = await wss.closed;

    assert.eq(closeCode, 4000, 'closeCode matches');
    assert.eq(reason, 'custom close', 'reason matches');
}

// Test: close with reason only (code defaults to 1000).
{
    const wss = new WebSocketStream(echoUrl);

    await wss.opened;

    wss.close({ reason: 'goodbye' });

    const { closeCode, reason } = await wss.closed;

    assert.eq(closeCode, 1000, 'closeCode defaults to 1000');
    assert.eq(reason, 'goodbye', 'reason matches');
}

// Test: close validation.
{
    const wss = new WebSocketStream(echoUrl);

    await wss.opened;

    assert.throws(() => wss.close({ closeCode: 1234 }), DOMException, 'invalid close code throws DOMException');

    const u8 = new Uint8Array(1024).fill(65);
    const longReason = new TextDecoder().decode(u8);

    assert.throws(() => wss.close({ closeCode: 1000, reason: longReason }), DOMException, 'long reason throws');

    wss.close();
    await wss.closed;
}

// Test: closing writable stream closes the WebSocket.
{
    const wss = new WebSocketStream(echoUrl);
    const { writable } = await wss.opened;

    await writable.close();

    const { closeCode } = await wss.closed;

    assert.eq(closeCode, 1005, 'closed via writable.close() (no status sent)');
}

// Test: aborting writable with WebSocketError sends close code.
{
    const wss = new WebSocketStream(echoUrl);
    const { writable } = await wss.opened;

    const writer = writable.getWriter();

    await writer.abort(new WebSocketError('', { closeCode: 4001, reason: 'abort reason' }));

    const { closeCode, reason } = await wss.closed;

    assert.eq(closeCode, 4001, 'closeCode from abort');
    assert.eq(reason, 'abort reason', 'reason from abort');
}

// Test: clean close results in readable done, writable errored.
{
    const wss = new WebSocketStream(echoUrl);
    const { readable, writable } = await wss.opened;

    const reader = readable.getReader();

    wss.close();
    await wss.closed;

    const { done } = await reader.read();

    assert.eq(done, true, 'readable is done after clean close');

    reader.releaseLock();

    const writer = writable.getWriter();

    try {
        await writer.write('should fail');
        assert.fail('write after close should throw');
    } catch (err) {
        assert.ok(err, 'write after close throws');
    }
}

// Test: AbortSignal (already aborted).
{
    const controller = new AbortController();

    controller.abort();

    const wss = new WebSocketStream(echoUrl, { signal: controller.signal });

    try {
        await wss.opened;
        assert.fail('should have rejected');
    } catch (err) {
        assert.ok(err, 'opened was rejected');
    }
}

// Test: invalid URL throws.
{
    assert.throws(() => new WebSocketStream('not-a-url'), DOMException, 'invalid URL throws DOMException');
}
