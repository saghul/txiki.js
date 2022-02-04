import assert from './assert.js';
import { path } from '@tjs/std';


const data = JSON.stringify({foo: 42, bar: 'baz!'});
const w = new Worker(path.join(import.meta.dirname, 'helpers', 'worker.js'));
const timer = setTimeout(() => {
    w.terminate();
}, 1000);
w.onmessage = event => {
    const recvData = JSON.stringify(event.data);
    assert.eq(data, recvData, 'Message received matches');
    w.terminate();
    clearTimeout(timer);
};
