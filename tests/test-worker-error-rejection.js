// An unhandled promise rejection that aborts a worker must surface an 'error'
// event on the parent Worker.
import assert from 'tjs:assert';

const code = `Promise.reject(new Error('rejected in worker'));`;
const blob = new Blob([code], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
const w = new Worker(url);
URL.revokeObjectURL(url);

const { promise, resolve, reject } = Promise.withResolvers();
const timer = setTimeout(() => reject(new Error('timed out waiting for error event')), 5000);

w.onerror = ev => {
    clearTimeout(timer);
    try {
        assert.ok(ev.message.includes('rejected in worker'), 'rejection reason propagated');
        resolve();
    } catch (e) {
        reject(e);
    } finally {
        w.terminate();
    }
};

await promise;
