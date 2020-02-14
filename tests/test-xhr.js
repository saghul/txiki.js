import { run, test } from './t.js';

test('basic XHR', async t => {
    const p = new Promise(resolve => {
        const url = 'https://httpbin.org/get';
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.onloadend = () => {
            t.eq(xhr.readyState, xhr.DONE, 'readyState is DONE');
            t.eq(xhr.responseURL, url, 'url is the same');
            t.eq(xhr.status, 200, 'status is 200');
            resolve();
        };
        xhr.send();
    });
    await p;
});

test('basic sync XHR', t => {
        const url = 'https://httpbin.org/get';
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.send();
        t.eq(xhr.readyState, xhr.DONE, 'readyState is DONE');
        t.eq(xhr.responseURL, url, 'url is the same');
        t.eq(xhr.status, 200, 'status is 200');
});

test('XHR persistent connection', t => {
        const url = 'https://httpbin.org/get';
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.send();
        t.eq(xhr.readyState, xhr.DONE, 'readyState is DONE');
        t.eq(xhr.responseURL, url, 'url is the same');
        t.eq(xhr.status, 200, 'status is 200');

        xhr.open('GET', url, false);
        xhr.send();
        t.eq(xhr.readyState, xhr.DONE, 'readyState is DONE');
        t.eq(xhr.responseURL, url, 'url is the same');
        t.eq(xhr.status, 200, 'status is 200');
});

test('basic XHR with EventTarget', async t => {
    const p = new Promise(resolve => {
        const url = 'https://httpbin.org/get';
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.addEventListener('loadend', () => {
            t.eq(xhr.readyState, xhr.DONE, 'readyState is DONE');
            t.eq(xhr.responseURL, url, 'url is the same');
            t.eq(xhr.status, 200, 'status is 200');
            resolve();
        });
        xhr.send();
    });
    await p;
});

test('XHR timeout', async t => {
    const p = new Promise(resolve => {
        const url = 'https://httpbin.org/delay/3';
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.timeout = 200;
        xhr.ontimeout = () => {
            t.ok(true, 'ontimeout was called');
            t.eq(xhr.readyState, xhr.DONE, 'readyState is DONE');
            resolve();
        };
        xhr.send();
    });
    await p;
});

test('XHR abort', async t => {
    const p = new Promise(resolve => {
        const url = 'https://httpbin.org/delay/3';
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.onabort = () => {
            t.ok(true, 'onabort was called');
            t.eq(xhr.readyState, xhr.UNSENT, 'readyState is UNSENT');
            resolve();
        };
        xhr.send();
        setTimeout(() => {
            xhr.abort();
        }, 200);
    });
    await p;
});

test('XHR with body', async t => {
    const p = new Promise(resolve => {
        const data = JSON.stringify({ foo: 'bar', bar: 'baz' });
        const url = 'https://httpbin.org/post';
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.responseType = 'json';
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onloadend = () => {
            t.eq(xhr.readyState, xhr.DONE, 'readyState is DONE');
            t.eq(xhr.responseURL, url, 'url is the same');
            t.eq(xhr.status, 200, 'status is 200');
            t.eq(xhr.response.data, data, 'sent and received data match');
            resolve();
        };
        xhr.send(data);
    });
    await p;
});


if (import.meta.main) {
    run();
}
