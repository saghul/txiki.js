// Regression test: a handled promise rejection followed by a native async
// callback used to leak GC objects, causing an assertion failure during
// JS_FreeRuntime shutdown:
//   Assertion failed: (list_empty(&rt->gc_obj_list))
//
// The root cause was JS_Throw being called from within QuickJS promise
// machinery (fulfill_or_reject_promise), setting current_exception while
// reactions were still being enqueued.

import assert from 'tjs:assert';

// 1. Handled rejection via await + try/catch.
try {
    await Promise.reject(new Error('handled rejection'));
} catch (e) {
    assert.eq(e.message, 'handled rejection');
}

// 2. Native async callback (setTimeout uses uv_timer, which triggers
//    tjs__execute_jobs via the check phase — the same path where the
//    deferred unhandled-rejection check now runs).
const result = await new Promise(resolve => setTimeout(() => resolve(42), 0));
assert.eq(result, 42);

// 3. Another handled rejection after the native callback.
try {
    await Promise.reject(new Error('second handled rejection'));
} catch (e) {
    assert.eq(e.message, 'second handled rejection');
}

// 4. Async function throw (same mechanism).
async function fail() {
    throw new Error('async throw');
}
try {
    await fail();
} catch (e) {
    assert.eq(e.message, 'async throw');
}

// 5. One more native async callback to confirm no leak.
const result2 = await new Promise(resolve => setTimeout(() => resolve(99), 0));
assert.eq(result2, 99);
