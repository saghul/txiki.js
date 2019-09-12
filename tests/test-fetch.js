import { run, test } from './t.js';

test('basic fetch', async t => {
    const r = await fetch('http://httpbin.org/get');
    t.eq(r.status, 200, 'status is 200');
});

test('abort fetch', async t => {
    const controller = new AbortController();
    const signal = controller.signal;
    setTimeout(() => {
        controller.abort();
    }, 500);
    try {
        const r = await fetch('http://httpbin.org/delay/3', { signal });
    } catch (e) {
        t.eq(e.name, 'AbortError', 'fetch was aborted');
    }
});


if (import.meta.main) {
    run();
}
