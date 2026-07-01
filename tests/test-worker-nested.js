import assert from 'tjs:assert';
import path from 'tjs:path';

// A worker can spawn another worker: messages and transfers flow across two
// levels of nesting, where worker B's parent is worker A rather than the main
// thread. This exercises the channel transport with a parent that is not the
// main runtime.

const a = new Worker(path.join(import.meta.dirname, 'helpers', 'worker-nested-a.js'));

const ab = new ArrayBuffer(4);
new Uint8Array(ab).set([ 1, 2, 3, 4 ]);

const result = await new Promise((resolve, reject) => {
    // Generous watchdog: spinning up two nested workers is slow under GC stress.
    const timer = setTimeout(() => reject(new Error('timeout')), 30000);

    a.onmessage = e => {
        clearTimeout(timer);
        resolve(e.data);
    };
    a.onerror = e => {
        clearTimeout(timer);
        reject(new Error(e.message));
    };

    a.postMessage({ value: 5, buf: ab }, [ ab ]);
});

assert.eq(ab.byteLength, 0, 'buffer detached in the main thread after transfer');
assert.eq(result.result, 60, 'value processed through A (+1) then B (*10): (5+1)*10');
assert.eq(result.sum, 10, 'grandchild summed the transferred buffer bytes');

a.terminate();
