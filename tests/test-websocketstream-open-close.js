import assert from 'tjs:assert';

const echoUrl = 'wss://ws.postman-echo.com/raw';

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
