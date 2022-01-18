import assert from './assert.js';
import { path } from '@tjs/std';

const { dirname, join } = path;

const thisFile = import.meta.url.slice(7);   // strip "file://"


const data = JSON.stringify({foo: 42, bar: 'baz!'});
const w = new Worker(join(dirname(thisFile), 'helpers', 'worker.js'));
const timer = setTimeout(() => {
    w.terminate();
}, 1000);
w.onmessage = event => {
    const recvData = JSON.stringify(event.data);
    assert.eq(data, recvData, 'Message received matches');
    w.terminate();
    clearTimeout(timer);
};
