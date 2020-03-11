import assert from './assert.js';


const url = 'https://httpbin.org/delay/3';
const xhr = new XMLHttpRequest();
xhr.open('GET', url);
xhr.timeout = 200;
xhr.ontimeout = () => {
    assert.ok(true, 'ontimeout was called');
    assert.eq(xhr.readyState, xhr.DONE, 'readyState is DONE');
};
xhr.send();
