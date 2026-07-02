import assert from 'tjs:assert';

// A throwing listener must be reported (per the DOM "report the exception"
// algorithm) rather than propagate out of dispatchEvent or stop co-listeners.

// Case 1: the exception is isolated — the next listener still runs, dispatchEvent
// returns normally, and a cancelable global 'error' ErrorEvent is fired.
{
    const target = new EventTarget();
    const order = [];
    const reported = [];
    const onError = e => {
        reported.push(e);
        e.preventDefault();
    };

    globalThis.addEventListener('error', onError);

    target.addEventListener('t', () => {
        order.push('a');
        throw new Error('boom');
    });
    target.addEventListener('t', () => order.push('b'));

    const ret = target.dispatchEvent(new Event('t'));

    globalThis.removeEventListener('error', onError);

    assert.eq(order, [ 'a', 'b' ], 'a listener after a throwing one still runs');
    assert.eq(ret, true, 'dispatchEvent returns normally after a listener throws');
    assert.eq(reported.length, 1, 'the exception is reported as one global error event');
    assert.eq(reported[0].type, 'error', 'reported as an event named "error"');
    assert.eq(reported[0].message, 'boom', 'error event carries the message');
    assert.ok(reported[0].error instanceof Error, 'error event carries the thrown error');
}

// Case 2: normal preventDefault still cancels a cancelable event (unchanged).
{
    const target = new EventTarget();

    target.addEventListener('c', e => e.preventDefault());
    assert.eq(target.dispatchEvent(new Event('c', { cancelable: true })), false, 'preventDefault → dispatchEvent returns false');
}

// Case 3: recursion guard — an 'error' handler that itself throws must not loop
// forever or crash, and reporting must still work afterwards (guard flag resets).
{
    const target = new EventTarget();
    const throwingOnError = () => {
        throw new Error('handler boom');
    };

    globalThis.addEventListener('error', throwingOnError);
    target.addEventListener('t', () => {
        throw new Error('inner');
    });
    target.dispatchEvent(new Event('t')); // must complete without hanging
    globalThis.removeEventListener('error', throwingOnError);

    const reported = [];
    const onError = e => {
        reported.push(e);
        e.preventDefault();
    };

    globalThis.addEventListener('error', onError);
    target.addEventListener('t2', () => {
        throw new Error('again');
    });
    target.dispatchEvent(new Event('t2'));
    globalThis.removeEventListener('error', onError);

    assert.eq(reported.length, 1, 'error reporting works again after a reentrant episode');
    assert.eq(reported[0].message, 'again', 'reports the later exception');
}
