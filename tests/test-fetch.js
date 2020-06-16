import assert from './assert.js';


async function basicFetch() {
    const r = await fetch('https://httpbin.org/get');
    assert.eq(r.status, 200, 'status is 200');
};

async function abortFetch() {
    const controller = new AbortController();
    const signal = controller.signal;
    setTimeout(() => {
        controller.abort();
    }, 500);
    try {
        await fetch('https://httpbin.org/delay/3', { signal });
    } catch (e) {
        assert.eq(e.name, 'AbortError', 'fetch was aborted');
    }
};

async function fetchWithPostAndBody() {
    const data = JSON.stringify({ foo: 'bar', bar: 'baz' });
    const r = await fetch('https://httpbin.org/post', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: data
    });
    assert.eq(r.status, 200, 'status is 200');
    const json = await r.json();
    assert.eq(json.data, data, 'sent and received data match');
};


(async () => {
    await basicFetch();
    await abortFetch();
    await fetchWithPostAndBody();
})();
