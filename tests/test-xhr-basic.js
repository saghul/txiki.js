import assert from './assert.js';


const url = 'https://httpbin.org/get';
const xhr = new XMLHttpRequest();
xhr.open('GET', url);
xhr.onloadend = () => {
    assert.eq(xhr.readyState, xhr.DONE, 'readyState is DONE');
    assert.eq(xhr.responseURL, url, 'url is the same');
    assert.eq(xhr.status, 200, 'status is 200');
};
xhr.send();

const xhrSync = new XMLHttpRequest();
xhrSync.open('GET', url, false);
xhrSync.send();
assert.eq(xhrSync.readyState, xhrSync.DONE, 'readyState is DONE');
assert.eq(xhrSync.responseURL, url, 'url is the same');
assert.eq(xhrSync.status, 200, 'status is 200');
