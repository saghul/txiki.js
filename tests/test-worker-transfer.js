import assert from 'tjs:assert';
import path from 'tjs:path';


const ab = new ArrayBuffer(16);
const data = new Uint8Array(ab).fill(42);
const w = new Worker(path.join(import.meta.dirname, 'helpers', 'worker-echo.js'));
const timer = setTimeout(() => {
    w.terminate();
    assert.fail('Timeout out waiting for worker');
}, 1000);
w.onmessage = event => {
    clearTimeout(timer);
    w.terminate();
    const recvData = event.data;
    assert.eq(recvData[0], 42);
};
w.postMessage(data, [ ab ]);
assert.is(data.buffer, ab);
assert.ok(ab.detached);