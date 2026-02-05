import assert from 'tjs:assert';

// Test 1: Abort before response (during fetch)
async function testAbortBeforeResponse() {
    const controller = new AbortController();

    // Abort immediately
    setTimeout(() => controller.abort(), 50);

    let threw = false;
    let errorName = null;

    try {
        await fetch('https://postman-echo.com/delay/3', {
            signal: controller.signal
        });
    } catch (e) {
        threw = true;
        errorName = e.name;
    }

    assert.ok(threw, 'Should have thrown when aborting before response');
    assert.eq(errorName, 'AbortError', 'throws AbortError');
}

// Test 2: Abort signal already aborted
async function testAlreadyAborted() {
    const controller = new AbortController();

    controller.abort();

    let threw = false;
    let errorName = null;

    try {
        await fetch('https://postman-echo.com/get', {
            signal: controller.signal
        });
    } catch (e) {
        threw = true;
        errorName = e.name;
    }

    assert.ok(threw, 'Should have thrown with already-aborted signal');
    assert.eq(errorName, 'AbortError', 'throws AbortError');
}

await testAbortBeforeResponse();
await testAlreadyAborted();
