import { run, test } from './t.js';

test('basic fetch', async t => {
    const r = await fetch('https://httpbin.org/get');
    t.eq(r.status, 200, 'status is 200');
});

test('abort fetch', async t => {
    const controller = new AbortController();
    const signal = controller.signal;
    setTimeout(() => {
        controller.abort();
    }, 500);
    try {
        const r = await fetch('https://httpbin.org/delay/3', { signal });
    } catch (e) {
        t.eq(e.name, 'AbortError', 'fetch was aborted');
    }
});

test('fetch with POST and body', async t => {
    const data = JSON.stringify({ foo: 'bar', bar: 'baz' });
    const r = await fetch('https://httpbin.org/post', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: data
    });
    t.eq(r.status, 200, 'status is 200');
    const json = await r.json();
    t.eq(json.data, data, 'sent and received data match');
});


if (import.meta.main) {
    run();
}
