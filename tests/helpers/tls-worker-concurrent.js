import assert from 'tjs:assert';
import cert from '../fixtures/server-cert.pem' with { type: 'text' };
import key from '../fixtures/server-key.pem' with { type: 'text' };

// HTTPS echo server on the main thread, with fetches from several Workers and
// from the main thread all at once. mbedtls' PSA state (key slots, RNG) is
// process-global, so this runs TLS 1.3 handshakes on several threads at once.
// Run under ThreadSanitizer with WORKERS / ROUNDS raised to stress it.

const WORKERS = Number(tjs.env.WORKERS ?? 4);
const ROUNDS = Number(tjs.env.ROUNDS ?? 10);

const server = tjs.serve({
    port: 0,
    tls: { cert, key },
    fetch: async req => new Response(`echo: ${await req.text()}`),
});
const url = `https://127.0.0.1:${server.port}/`;

async function fetchRounds(id) {
    let ok = 0;
    const errors = [];

    for (let i = 0; i < ROUNDS; i++) {
        const body = `${id}-${i}`;

        try {
            const r = await fetch(url, { method: 'POST', body });
            const text = await r.text();

            if (r.status === 200 && text === `echo: ${body}`) {
                ok++;
            } else {
                errors.push(`${body}: status ${r.status}, body ${JSON.stringify(text)}`);
            }
        } catch (e) {
            errors.push(`${body}: ${e}`);
        }
    }

    return { ok, errors };
}

const workerSrc = `
const url = ${JSON.stringify(url)};
const ROUNDS = ${ROUNDS};
${fetchRounds.toString()}
self.onmessage = async e => self.postMessage(await fetchRounds(e.data));
`;
const workerUrl = URL.createObjectURL(new Blob([ workerSrc ], { type: 'text/javascript' }));
const workers = [];

function runWorker(id) {
    const w = new Worker(workerUrl);

    workers.push(w);

    return new Promise((resolve, reject) => {
        w.onmessage = e => resolve(e.data);
        w.onerror = e => reject(new Error(`worker ${id}: ${e.message}`));
        w.postMessage(`w${id}`);
    });
}

try {
    const jobs = [];

    for (let i = 0; i < WORKERS; i++) {
        jobs.push(runWorker(i));
    }

    jobs.push(fetchRounds('main'));

    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timed out')), 120000);
    });
    const results = await Promise.race([ Promise.all(jobs), timeout ]);

    clearTimeout(timer);

    const ok = results.reduce((n, r) => n + r.ok, 0);
    const errors = results.flatMap(r => r.errors);

    console.log(`ok: ${ok}/${(WORKERS + 1) * ROUNDS}, errors: ${errors.length}`);
    assert.eq(errors.length, 0, `fetch errors:\n${errors.join('\n')}`);
    assert.eq(ok, (WORKERS + 1) * ROUNDS, 'every fetch echoed its body');
} finally {
    for (const w of workers) {
        w.terminate();
    }

    await server.close();
}
