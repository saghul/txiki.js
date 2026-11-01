// Terminate workers while the threadpool work they started is still running.
// Usage: worker-terminate-threadpool.js <digest|fswrite> [dir]

import path from 'tjs:path';

const [ variant, dir ] = tjs.args.slice(3);
const url = path.join(import.meta.dirname, `worker-threadpool-${variant}.js`);

for (let i = 0; i < 5; i++) {
    const w = new Worker(url);
    const started = new Promise(resolve => {
        w.onmessage = resolve;
    });

    w.postMessage(dir ? path.join(dir, `out-${i}`) : null);
    await started;
    w.terminate();
    await new Promise(resolve => setTimeout(resolve, 20));
}

console.log(`${variant}: ok`);
