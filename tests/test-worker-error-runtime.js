// An uncaught exception thrown from a worker message handler must surface an
// 'error' event on the parent Worker.
import assert from 'tjs:assert';

const code = `
    self.onmessage = () => { throw new RangeError('boom at runtime'); };
    self.postMessage('ready');
`;
const blob = new Blob([code], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
const w = new Worker(url);
URL.revokeObjectURL(url);

const { promise, resolve, reject } = Promise.withResolvers();
const timer = setTimeout(() => reject(new Error('timed out waiting for error event')), 5000);

w.onmessage = () => w.postMessage('go');

w.onerror = ev => {
    clearTimeout(timer);
    try {
        assert.ok(ev.message.includes('boom at runtime'), 'message propagated');
        assert.eq(ev.error?.name, 'RangeError', 'error name propagated');
        resolve();
    } catch (e) {
        reject(e);
    } finally {
        w.terminate();
    }
};

await promise;
