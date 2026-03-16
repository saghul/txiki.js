import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, baseUrl } = createEchoServer();

async function basicFetch() {
    const r = await fetch(`${baseUrl}/get`);
    assert.eq(r.status, 200, 'status is 200');
};

async function abortFetch() {
    const controller = new AbortController();
    const signal = controller.signal;
    setTimeout(() => {
        controller.abort();
    }, 500);
    try {
        await fetch(`${baseUrl}/delay/3`, { signal });
    } catch (e) {
        assert.eq(e.name, 'AbortError', 'fetch was aborted');
    }
};

async function fetchWithPostAndBody() {
    const data = JSON.stringify({ foo: 'bar', bar: 'baz' });
    const r = await fetch(`${baseUrl}/post`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: data
    });
    assert.eq(r.status, 200, 'status is 200');
    const json = await r.json();
    assert.eq(JSON.stringify(json.data), data, 'sent and received data match');
};

async function fetchWithBlobBody() {
    const r = await fetch(`${baseUrl}/image.jpg`);
    assert.eq(r.status, 200, 'status is 200');
    const blob = await r.blob();
    assert.eq(blob.type, 'image/jpeg', 'response is jpeg image')
}

async function fetchWithRedirect() {
    const url = `${baseUrl}/redirect`;
    const targetUrl = `${baseUrl}/redirect-target`;

    const r1 = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
    });
    assert.eq(r1.status, 200, 'status is 200');
    assert.ok(r1.url.startsWith(targetUrl), 'url has changed')

    const r2 = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
    });
    assert.eq(r2.status, 301, 'status is 301');
    assert.eq(r2.url, url, 'url is the same')
    assert.ok(r2.headers.get('location').startsWith(targetUrl), 'location header is correct');

    let hasError = false;
    await fetch(url, {
        method: 'GET',
        redirect: 'error',
    }).catch((err) => {
        hasError = true;
    });
    assert.ok(hasError, 'redirect causes error');
}

await basicFetch();
await abortFetch();
await fetchWithPostAndBody();
await fetchWithBlobBody();
await fetchWithRedirect();

server.close();
