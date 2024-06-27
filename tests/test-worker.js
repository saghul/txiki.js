import assert from 'tjs:assert';
import path from 'tjs:path';


const data = JSON.stringify({foo: 42, bar: 'baz!'});
const w = new Worker(path.join(import.meta.dirname, 'helpers', 'worker.js'));
const timer = setTimeout(() => {
    w.terminate();
    assert.fail('Timeout out waiting for worker');
}, 1000);
w.onmessage = event => {
    clearTimeout(timer);
    w.terminate();
    const recvData = JSON.stringify(event.data);
    assert.eq(data, recvData, 'Message received matches');
};
