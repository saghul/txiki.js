import assert from 'tjs:assert';


const data = JSON.stringify({ foo: 'bar', bar: 'baz' });
const url = 'https://postman-echo.com/post';
const xhr = new XMLHttpRequest();
xhr.open('POST', url);
xhr.responseType = 'json';
xhr.setRequestHeader('Content-Type', 'application/json');
xhr.onloadend = () => {
    assert.eq(xhr.readyState, xhr.DONE, 'readyState is DONE');
    assert.eq(xhr.responseURL, url, 'url is the same');
    assert.eq(xhr.status, 200, 'status is 200');
    assert.eq(JSON.stringify(xhr.response.data), data, 'sent and received data match');
};
xhr.send(data);
