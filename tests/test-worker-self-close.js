// self.close() stops the worker's event loop: a task queued before close()
// must not run. Calling terminate() afterwards must be safe even though the
// worker already stopped itself.
import assert from 'tjs:assert';

const code = `
    self.postMessage('ready');
    setTimeout(() => self.postMessage('should-not-arrive'), 50);
    self.close();
`;
const blob = new Blob([code], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
const w = new Worker(url);
URL.revokeObjectURL(url);

const { promise, resolve, reject } = Promise.withResolvers();

let sawLate = false;
w.onmessage = ev => {
    if (ev.data === 'should-not-arrive') {
        sawLate = true;
    }
};

// 'ready' arrives, then we wait long enough for the (cancelled) timer to have
// fired had the loop kept running.
setTimeout(() => {
    try {
        assert.ok(!sawLate, 'task queued before close() did not run');
        // terminate() after the worker already self-closed must not crash.
        w.terminate();
        resolve();
    } catch (e) {
        reject(e);
    }
}, 300);

await promise;
