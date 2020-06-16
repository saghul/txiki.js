import assert from './assert.js';


const url = 'https://httpbin.org/delay/3';
const xhr = new XMLHttpRequest();
xhr.open('GET', url);
xhr.onabort = () => {
    assert.ok(true, 'onabort was called');
    assert.eq(xhr.readyState, xhr.UNSENT, 'readyState is UNSENT');
};
xhr.send();
setTimeout(() => {
    xhr.abort();
}, 200);
