import assert from 'tjs:assert';


const url = 'https://postman-echo.com/delay/3';
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
