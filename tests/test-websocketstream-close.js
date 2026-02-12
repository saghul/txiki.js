import assert from 'tjs:assert';

const echoUrl = 'wss://ws.postman-echo.com/raw';

// Test: close with custom code and reason.
{
    console.log('[TEST] close: test 1 starting');
    const wss = new WebSocketStream(echoUrl);

    await wss.opened;
    console.log('[TEST] close: test 1 opened');

    wss.close({ closeCode: 4000, reason: 'custom close' });

    const { closeCode, reason } = await wss.closed;
    console.log('[TEST] close: test 1 closed, code:', closeCode, 'reason:', reason);

    assert.eq(closeCode, 4000, 'closeCode matches');
    assert.eq(reason, 'custom close', 'reason matches');
    console.log('[TEST] close: test 1 done');
}

// Test: close with reason only (code defaults to 1000).
{
    console.log('[TEST] close: test 2 starting');
    const wss = new WebSocketStream(echoUrl);

    await wss.opened;
    console.log('[TEST] close: test 2 opened');

    wss.close({ reason: 'goodbye' });

    const { closeCode, reason } = await wss.closed;
    console.log('[TEST] close: test 2 closed, code:', closeCode, 'reason:', reason);

    assert.eq(closeCode, 1000, 'closeCode defaults to 1000');
    assert.eq(reason, 'goodbye', 'reason matches');
    console.log('[TEST] close: test 2 done');
}

// Test: close validation.
{
    console.log('[TEST] close: test 3 starting');
    const wss = new WebSocketStream(echoUrl);

    await wss.opened;
    console.log('[TEST] close: test 3 opened');

    assert.throws(() => wss.close({ closeCode: 1234 }), DOMException, 'invalid close code throws DOMException');

    const u8 = new Uint8Array(1024).fill(65);
    const longReason = new TextDecoder().decode(u8);

    assert.throws(() => wss.close({ closeCode: 1000, reason: longReason }), DOMException, 'long reason throws');

    wss.close();
    await wss.closed;
    console.log('[TEST] close: test 3 done');
}

// Test: closing writable stream closes the WebSocket.
{
    console.log('[TEST] close: test 4 starting');
    const wss = new WebSocketStream(echoUrl);
    const { writable } = await wss.opened;
    console.log('[TEST] close: test 4 opened');

    await writable.close();
    console.log('[TEST] close: test 4 writable.close() resolved');

    const { closeCode } = await wss.closed;
    console.log('[TEST] close: test 4 closed, code:', closeCode);

    assert.eq(closeCode, 1005, 'closed via writable.close() (no status sent)');
    console.log('[TEST] close: test 4 done');
}
