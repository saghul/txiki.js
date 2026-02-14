import assert from 'tjs:assert';


const url = 'https://httpbin.org/get';

const { lengthComputable, loaded, total } = await new Promise((resolve, reject) => {
    let lastEvt;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onprogress = (evt) => {
        lastEvt = evt;
    };
    xhr.onload = () => {
        assert.eq(xhr.status, 200, 'status is 200');
        resolve({
            lengthComputable: lastEvt.lengthComputable,
            loaded: lastEvt.loaded,
            total: lastEvt.total,
        });
    };
    xhr.onerror = () => reject(new Error('XHR error'));
    xhr.send();
});

assert.eq(lengthComputable, true, 'progress length is computable');
assert.eq(typeof loaded, 'number', 'final progress loaded size is a number');
assert.eq(typeof total, 'number', 'final progress total size is a number');
assert.ok(total >= 0, 'final progress total size is greater than 0');
assert.eq(loaded, total, 'final progress loaded size equals total size');
