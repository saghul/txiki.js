import assert from 'tjs:assert';


const data = JSON.stringify({ foo: 42, bar: 'baz!' });
const w = new Worker(new URL('./helpers/worker-echo.js', import.meta.url));
const { promise, resolve, reject } = Promise.withResolvers();
const timer = setTimeout(() => reject(new Error('Timeout out waiting for worker')), 1000);

w.onerror = event => reject(new Error(`worker failed to load: ${event.message}`));
w.onmessage = event => resolve(event.data);
w.postMessage(data);

try {
    assert.eq(await promise, data, 'Message received matches');
} finally {
    clearTimeout(timer);
    w.terminate();
}
