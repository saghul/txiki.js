// tests/test-xhr-headers.js
import assert from 'tjs:assert';

const url = 'https://postman-echo.com/get';
const xhr = new XMLHttpRequest();
xhr.open('GET', url, false);
xhr.setRequestHeader('Content-Type', 'application/json');
xhr.send();

xhr.open('POST', url, false);
xhr.send();
