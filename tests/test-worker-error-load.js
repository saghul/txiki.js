// A worker that throws while loading (module evaluation) must surface an
// 'error' event on the parent Worker with the error details.
import assert from 'tjs:assert';

const code = `throw new TypeError('boom at load');`;
const blob = new Blob([code], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
const w = new Worker(url);
URL.revokeObjectURL(url);

const { promise, resolve, reject } = Promise.withResolvers();
const timer = setTimeout(() => reject(new Error('timed out waiting for error event')), 5000);

w.onerror = ev => {
    clearTimeout(timer);
    try {
        assert.ok(ev instanceof ErrorEvent, 'event is an ErrorEvent');
        assert.ok(ev.message.includes('boom at load'), 'message propagated');
        assert.eq(ev.error?.name, 'TypeError', 'error name propagated');
        resolve();
    } catch (e) {
        reject(e);
    } finally {
        w.terminate();
    }
};

await promise;
