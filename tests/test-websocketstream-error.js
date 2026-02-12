import assert from 'tjs:assert';

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

// Test: invalid URL throws.
{
    assert.throws(() => new WebSocketStream('not-a-url'), DOMException, 'invalid URL throws DOMException');
}
