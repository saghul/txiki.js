import assert from 'tjs:assert';

const echoUrl = 'wss://ws.postman-echo.com/raw';

// Test: aborting writable with WebSocketError sends close code.
{
    console.log('[TEST] abort: test 1 starting');
    const wss = new WebSocketStream(echoUrl);
    const { writable } = await wss.opened;
    console.log('[TEST] abort: opened');

    const writer = writable.getWriter();

    await writer.abort(new WebSocketError('', { closeCode: 4001, reason: 'abort reason' }));
    console.log('[TEST] abort: writer.abort() resolved');

    const { closeCode, reason } = await wss.closed;
    console.log('[TEST] abort: closed, code:', closeCode, 'reason:', reason);

    assert.eq(closeCode, 4001, 'closeCode from abort');
    assert.eq(reason, 'abort reason', 'reason from abort');
    console.log('[TEST] abort: test 1 done');
}

// Test: clean close results in readable done, writable errored.
{
    console.log('[TEST] abort: test 2 starting');
    const wss = new WebSocketStream(echoUrl);
    const { readable, writable } = await wss.opened;
    console.log('[TEST] abort: test 2 opened');

    const reader = readable.getReader();

    wss.close();
    console.log('[TEST] abort: close() called');
    await wss.closed;
    console.log('[TEST] abort: closed resolved');

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
    console.log('[TEST] abort: test 2 done');
}

// Test: AbortSignal (already aborted).
{
    console.log('[TEST] abort: test 3 starting');
    const controller = new AbortController();

    controller.abort();

    const wss = new WebSocketStream(echoUrl, { signal: controller.signal });

    try {
        await wss.opened;
        assert.fail('should have rejected');
    } catch (err) {
        assert.ok(err, 'opened was rejected');
    }
    console.log('[TEST] abort: test 3 done');
}
