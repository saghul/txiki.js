import assert from 'tjs:assert';


const url = 'https://postman-echo.com/delay/3';
const xhr = new XMLHttpRequest();
xhr.open('GET', url);
xhr.timeout = 200;
xhr.ontimeout = () => {
    assert.ok(true, 'ontimeout was called');
    assert.eq(xhr.readyState, xhr.DONE, 'readyState is DONE');
};
xhr.send();
