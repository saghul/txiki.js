// Helper for test-unhandled-rejection-sync-catch.js
// Tests that synchronously-caught rejections do NOT fire unhandledrejection.

let unhandledCount = 0;

window.addEventListener('unhandledrejection', event => {
    unhandledCount++;
    event.preventDefault();
});

// Synchronously-caught rejection at top level.
Promise.reject(new Error('top-level')).catch(err => err);

// Use setTimeout to test inside an event handler callback.
setTimeout(() => {
    Promise.reject(new Error('in-callback')).catch(err => err);

    // Check after another tick to ensure no events fired.
    setTimeout(() => {
        if (unhandledCount !== 0) {
            console.error(`FAIL: expected 0 unhandled rejections, got ${unhandledCount}`);
            tjs.exit(1);
        }
        console.log('OK');
    }, 10);
}, 10);
