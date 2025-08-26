import assert from 'tjs:assert';

const url = 'https://postman-echo.com/cookies';
const cookieValue = Math.random().toString();

const xhr = new XMLHttpRequest();

xhr.withCredentials = true;
xhr.open('GET', url + '/set?key=' + cookieValue, false);
xhr.send();
assert.eq(xhr.readyState, xhr.DONE, 'readyState is DONE');
assert.eq(xhr.responseURL, url, 'url is the same');
assert.eq(xhr.status, 200, 'status is 200');

xhr.withCredentials = false;
xhr.open('GET', url, false);
xhr.send();

let result = JSON.parse(xhr.responseText);
assert.eq(result.cookies.key, undefined, 'cookies is omitted');

xhr.withCredentials = true;
xhr.open('GET', url, false);
xhr.send();

result = JSON.parse(xhr.responseText);
assert.eq(result.cookies.key, cookieValue, 'cookies is same');