// A running Worker must stay alive even when the parent can no longer reach it
// from JS (here it is only referenced from a suspended async frame): the GC
// must not collect and stop it while its thread is still running.
import assert from 'tjs:assert';

const src = 'setTimeout(() => self.postMessage(\'ok\'), 200);';
const gcTimer = setInterval(() => tjs.engine.gc.run(), 20);
// A healthy run takes ~200ms, but ~7s on a GC-stress build.
const watchdogMs = tjs.env.TJS_GC_STRESS ? 60000 : 5000;
let watchdog;
const timeout = new Promise((_, reject) => {
    watchdog = setTimeout(() => reject(new Error('worker message never arrived')), watchdogMs);
});

async function round() {
    const ws = Array.from({ length: 4 }, () => {
        const url = URL.createObjectURL(new Blob([ src ], { type: 'text/javascript' }));
        const w = new Worker(url);

        URL.revokeObjectURL(url);

        return w;
    });
    const res = await Promise.all(ws.map(w => new Promise(resolve => {
        w.onmessage = e => resolve(e.data);
    })));

    ws.forEach(w => w.terminate());

    return res;
}

try {
    const res = await Promise.race([ round(), timeout ]);

    assert.equal(res, [ 'ok', 'ok', 'ok', 'ok' ], 'every worker delivered its message');
} finally {
    clearInterval(gcTimer);
    clearTimeout(watchdog);
}
