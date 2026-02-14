import assert from 'tjs:assert';

// This test simulates aggressive GC that might happen with concurrent operations.
// It aims to detect regressions in the `fetch` implementation.
const gcInterval = setInterval(() => {
    tjs.engine.gc.run();
}, 50);

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000);

try {
    const res = await fetch('https://postman-echo.com/delay/2', {
        signal: controller.signal
    });

    assert.eq(res.status, 200);
} catch (err) {
    assert.ok(false, `fetch failed: ${err.message}`);
} finally {
    clearTimeout(timeout);
    clearInterval(gcInterval);
}
