import assert from 'tjs:assert';

// Basic AbortController / AbortSignal
{
    const controller = new AbortController();
    const signal = controller.signal;

    assert.ok(signal instanceof AbortSignal, 'signal is an AbortSignal');
    assert.ok(signal instanceof EventTarget, 'signal is an EventTarget');
    assert.eq(signal.aborted, false, 'signal starts not aborted');
    assert.eq(signal.reason, undefined, 'reason is undefined before abort');
}

// abort() sets aborted and reason
{
    const controller = new AbortController();

    controller.abort();

    assert.eq(controller.signal.aborted, true, 'aborted is true after abort');
    assert.ok(controller.signal.reason instanceof DOMException, 'default reason is DOMException');
    assert.eq(controller.signal.reason.name, 'AbortError', 'default reason name is AbortError');
}

// abort() with custom reason
{
    const controller = new AbortController();
    const reason = new Error('custom reason');

    controller.abort(reason);

    assert.eq(controller.signal.aborted, true, 'aborted after custom abort');
    assert.eq(controller.signal.reason, reason, 'custom reason is preserved');
}

// abort() is idempotent
{
    const controller = new AbortController();
    const reason1 = new Error('first');
    const reason2 = new Error('second');

    controller.abort(reason1);
    controller.abort(reason2);

    assert.eq(controller.signal.reason, reason1, 'first reason is kept');
}

// addEventListener('abort') fires on abort
{
    const controller = new AbortController();
    let called = false;

    controller.signal.addEventListener('abort', () => {
        called = true;
    });

    controller.abort();
    assert.ok(called, 'abort listener was called');
}

// onabort handler fires
{
    const controller = new AbortController();
    let called = false;

    controller.signal.onabort = () => {
        called = true;
    };

    controller.abort();
    assert.ok(called, 'onabort was called');
}

// abort event only fires once
{
    const controller = new AbortController();
    let count = 0;

    controller.signal.addEventListener('abort', () => {
        count++;
    });

    controller.abort();
    controller.abort();

    assert.eq(count, 1, 'abort listener fires only once');
}

// throwIfAborted() does not throw when not aborted
{
    const controller = new AbortController();

    controller.signal.throwIfAborted();
}

// throwIfAborted() throws when aborted
{
    const controller = new AbortController();
    const reason = new Error('aborted!');

    controller.abort(reason);

    let threw = false;

    try {
        controller.signal.throwIfAborted();
    } catch (e) {
        threw = true;
        assert.eq(e, reason, 'throwIfAborted throws the reason');
    }

    assert.ok(threw, 'throwIfAborted threw');
}

// AbortSignal.abort() creates a pre-aborted signal
{
    const signal = AbortSignal.abort();

    assert.eq(signal.aborted, true, 'abort() signal is aborted');
    assert.ok(signal.reason instanceof DOMException, 'abort() default reason is DOMException');
    assert.eq(signal.reason.name, 'AbortError', 'abort() reason name is AbortError');
}

// AbortSignal.abort(reason) with custom reason
{
    const reason = new Error('custom');
    const signal = AbortSignal.abort(reason);

    assert.eq(signal.aborted, true, 'abort(reason) signal is aborted');
    assert.eq(signal.reason, reason, 'abort(reason) preserves reason');
}

// AbortSignal.timeout()
{
    const signal = AbortSignal.timeout(50);

    assert.eq(signal.aborted, false, 'timeout signal starts not aborted');

    await new Promise(resolve => {
        signal.addEventListener('abort', resolve);
    });

    assert.eq(signal.aborted, true, 'timeout signal aborts');
    assert.ok(signal.reason instanceof DOMException, 'timeout reason is DOMException');
    assert.eq(signal.reason.name, 'TimeoutError', 'timeout reason name is TimeoutError');
}

// AbortSignal.any() with no aborted signals
{
    const c1 = new AbortController();
    const c2 = new AbortController();
    const signal = AbortSignal.any([c1.signal, c2.signal]);

    assert.eq(signal.aborted, false, 'any() signal starts not aborted');

    let aborted = false;

    signal.addEventListener('abort', () => {
        aborted = true;
    });

    c1.abort(new Error('c1'));

    assert.eq(signal.aborted, true, 'any() signal aborts when source aborts');
    assert.eq(signal.reason.message, 'c1', 'any() reason matches source');
    assert.ok(aborted, 'any() abort event fired');
}

// AbortSignal.any() with already aborted signal
{
    const c1 = new AbortController();

    c1.abort(new Error('already'));

    const signal = AbortSignal.any([c1.signal]);

    assert.eq(signal.aborted, true, 'any() with aborted input is immediately aborted');
    assert.eq(signal.reason.message, 'already', 'any() reason matches pre-aborted source');
}

// AbortSignal.any() only fires once even with multiple signals
{
    const c1 = new AbortController();
    const c2 = new AbortController();
    const signal = AbortSignal.any([c1.signal, c2.signal]);
    let count = 0;

    signal.addEventListener('abort', () => {
        count++;
    });

    c1.abort();
    c2.abort();

    assert.eq(count, 1, 'any() fires abort only once');
}

// Symbol.toStringTag
{
    const controller = new AbortController();
    const signal = controller.signal;

    assert.eq(Object.prototype.toString.call(controller), '[object AbortController]', 'controller toStringTag');
    assert.eq(Object.prototype.toString.call(signal), '[object AbortSignal]', 'signal toStringTag');
}
