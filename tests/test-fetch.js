import assert from 'tjs:assert';


async function basicFetch() {
    const r = await fetch('https://postman-echo.com/get');
    assert.eq(r.status, 200, 'status is 200');
};

async function abortFetch() {
    const controller = new AbortController();
    const signal = controller.signal;
    setTimeout(() => {
        controller.abort();
    }, 500);
    try {
        await fetch('https://postman-echo.com/delay/3', { signal });
    } catch (e) {
        assert.eq(e.name, 'AbortError', 'fetch was aborted');
    }
};

async function fetchWithPostAndBody() {
    const data = JSON.stringify({ foo: 'bar', bar: 'baz' });
    const r = await fetch('https://postman-echo.com/post', {
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
    const r = await fetch('https://picsum.photos/id/237/200/300');
    assert.eq(r.status, 200, 'status is 200');
    const blob = await r.blob();
    assert.eq(blob.type, 'image/jpeg', 'response is jpeg image')
}


await basicFetch();
await abortFetch();
await fetchWithPostAndBody();
await fetchWithBlobBody();
