// Calling preventDefault() on the worker's own 'error' event suppresses
// propagation to the parent Worker's 'error' event.
import assert from 'tjs:assert';

const code = `
    self.onerror = e => { e.preventDefault(); };
    self.onmessage = () => { throw new Error('handled inside worker'); };
    self.postMessage('ready');
`;
const blob = new Blob([code], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
const w = new Worker(url);
URL.revokeObjectURL(url);

const { promise, resolve, reject } = Promise.withResolvers();

let sawError = false;
w.onmessage = () => w.postMessage('go');
w.onerror = () => { sawError = true; };

// Give the worker time to throw; the parent must not receive an error event.
setTimeout(() => {
    try {
        assert.ok(!sawError, 'preventDefault() suppressed the parent error event');
        w.terminate();
        resolve();
    } catch (e) {
        reject(e);
    }
}, 300);

await promise;
