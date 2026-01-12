import assert from 'tjs:assert';

// This test simulate aggressive GC that might happen with concurrent operations.
// It aims to detect regressions in the `fetch` implementation.
const gcInterval = setInterval(() => {
    tjs.engine.gc.run();
}, 50);

Promise.race([
    fetch('https://postman-echo.com/delay/2'),
    new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error("XHR has been garbage collected")), 3000);
    }),
])
    .then((res) => {
        assert.eq(res.status, 200);
        clearInterval(gcInterval);
    })
    .catch((err) => {
        assert.ok(false, err);
    })

