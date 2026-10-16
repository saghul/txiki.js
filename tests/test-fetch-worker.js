import assert from 'tjs:assert';

// lws-backed network APIs work inside workers, including nested ones: the
// worker runtime inherits the parent's lws configuration (cookie jar, CA bundle).

const server = tjs.serve({ port: 0, fetch: () => new Response('ok') });
const url = `http://127.0.0.1:${server.port}/`;

function blobUrl(src) {
    return URL.createObjectURL(new Blob([ src ], { type: 'text/javascript' }));
}

function runWorker(src, label) {
    const w = new Worker(blobUrl(src));

    return new Promise(resolve => {
        // Generous watchdog: nested workers are slow to spin up under GC stress.
        const timer = setTimeout(() => {
            w.terminate();
            assert.fail(`Timed out waiting for worker (${label})`);
        }, 30000);

        w.onmessage = e => {
            clearTimeout(timer);
            w.terminate();
            resolve(e.data);
        };
        w.onerror = e => {
            clearTimeout(timer);
            w.terminate();
            assert.fail(`worker error (${label}): ${e.message}`);
        };
    });
}

const fetchSrc = `
fetch(${JSON.stringify(url)})
    .then(r => r.text())
    .then(t => self.postMessage('ok:' + t), e => self.postMessage('err:' + e));
`;

const xhrSrc = `
const xhr = new XMLHttpRequest();
xhr.onload = () => self.postMessage('ok:' + xhr.responseText);
xhr.onerror = () => self.postMessage('err:xhr');
xhr.open('GET', ${JSON.stringify(url)});
xhr.send();
`;

const nestedSrc = `
const inner = new Worker(URL.createObjectURL(new Blob([ ${JSON.stringify(fetchSrc)} ], { type: 'text/javascript' })));
inner.onmessage = e => {
    inner.terminate();
    self.postMessage(e.data);
};
inner.onerror = e => self.postMessage('err:' + e.message);
`;

try {
    assert.eq(await runWorker(fetchSrc, 'fetch'), 'ok:ok', 'fetch() works in a worker');
    assert.eq(await runWorker(xhrSrc, 'xhr'), 'ok:ok', 'XMLHttpRequest works in a worker');
    assert.eq(await runWorker(nestedSrc, 'nested'), 'ok:ok', 'fetch() works in a nested worker');
} finally {
    await server.close();
}
