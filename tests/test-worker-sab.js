import assert from 'tjs:assert';
import path from 'tjs:path';


const magic = 42;
const sab = new SharedArrayBuffer(16);
const i32 = new Int32Array(sab);

const w = new Worker(path.join(import.meta.dirname, 'helpers', 'worker-sab.js'));
const timer = setTimeout(() => {
    w.terminate();
    assert.fail('Timeout out waiting for worker');
}, 1500);
w.onmessage = event => {
    clearTimeout(timer);
    assert.ok(event.data.success, 'The value change was detected');
    assert.eq(i32[0], magic, 'Magic value was set');
    w.terminate();
};
w.onmessageerror = event => {
    assert.fail(`Error receiving message from worker: ${event}`);
};
w.postMessage(i32);
setTimeout(() => {
    Atomics.store(i32, 0 , magic);
    Atomics.notify(i32, 0);
}, 100);
