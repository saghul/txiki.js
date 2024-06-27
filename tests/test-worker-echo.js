import assert from 'tjs:assert';
import path from 'tjs:path';


const data = JSON.stringify({foo: 42, bar: 'baz!'});
const w = new Worker(path.join(import.meta.dirname, 'helpers', 'worker-echo.js'));
const timer = setTimeout(() => {
    w.terminate();
    assert.fail('Timeout out waiting for worker');
}, 1000);
w.onmessage = event => {
    clearTimeout(timer);
    w.terminate();
    const recvData = event.data;
    assert.eq(recvData, data, 'Message received matches');
};
w.postMessage(`${data}`);
