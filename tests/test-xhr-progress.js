import assert from './assert.js';


let lengthComputable = false,  loaded, total;
const url = 'https://httpbin.org/get';
const xhrSync = new XMLHttpRequest();
xhrSync.open('GET', url, false);
xhrSync.onprogress = (evt) => {
    lengthComputable = evt.lengthComputable;
    loaded = evt.loaded;
    total = evt.total;
};
xhrSync.send();

assert.eq(xhrSync.status, 200, 'status is 200');
assert.eq(lengthComputable, true, 'progress length is computable');
assert.eq(typeof loaded, 'number', 'final progress loaded size is a number');
assert.eq(typeof total, 'number', 'final progress total size is a number');
assert.ok(total >= 0, 'final progress total size is greater than 0');
assert.eq(loaded, total, 'final progress loaded size equals total size');
