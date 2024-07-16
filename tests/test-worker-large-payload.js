import assert from 'tjs:assert';
import path from 'tjs:path';


const data = {
    x: new Array(65536).fill('x').join(''),
    y: new Array(65536).fill('y').join(''),
    z: 1234
};
const w = new Worker(path.join(import.meta.dirname, 'helpers', 'worker-echo.js'));
const timer = setTimeout(() => {
    w.terminate();
    assert.fail('Timeout out waiting for worker');
}, 1000);
w.onmessage = event => {
    clearTimeout(timer);
    const recvData = event.data;
    assert.eq(data.x, recvData.x, 'Message received matches');
    assert.eq(data.y, recvData.y, 'Message received matches');
    assert.eq(data.z, recvData.z, 'Message received matches');
    w.terminate();
};
w.onmessageerror = event => {
    assert.fail(`Error receiving message from worker: ${event}`);
};
w.postMessage(data);
