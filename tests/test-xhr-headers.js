// tests/test-xhr-headers.js
import assert from 'tjs:assert';

function doXhr(method, url, headers) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url);
        if (headers) {
            for (const [key, value] of Object.entries(headers)) {
                xhr.setRequestHeader(key, value);
            }
        }
        xhr.onload = () => resolve(xhr);
        xhr.onerror = () => reject(new Error('XHR error'));
        xhr.send();
    });
}

const url = 'https://postman-echo.com/get';
await doXhr('GET', url, { 'Content-Type': 'application/json' });
await doXhr('POST', url);
