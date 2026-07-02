import assert from 'tjs:assert';

// EventSource is a global in workers too (they run the same polyfill bundle).
const src = 'self.postMessage(typeof EventSource);';
const blob = new Blob([ src ], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);

const w = new Worker(url);

URL.revokeObjectURL(url);

const timer = setTimeout(() => {
    w.terminate();
    assert.fail('Timed out waiting for worker');
}, 1000);

w.onmessage = event => {
    clearTimeout(timer);
    w.terminate();
    assert.eq(event.data, 'function', 'EventSource is a constructor in workers');
};
