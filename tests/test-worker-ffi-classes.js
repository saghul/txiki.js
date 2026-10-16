import assert from 'tjs:assert';
import path from 'tjs:path';

// Native classes must be allocated per runtime: Workers that register the FFI
// classes before the main runtime ever does must not collide with the classes
// the Worker runtime already registered at bootstrap (issue #1120). This file
// must not import tjs:ffi until the workers are done.
const NUM_WORKERS = 4;
const workerPath = path.join(import.meta.dirname, 'helpers', 'worker-ffi-classes.js');
const workers = [];
const pending = [];

for (let i = 0; i < NUM_WORKERS; i++) {
    const { promise, resolve, reject } = Promise.withResolvers();
    const w = new Worker(workerPath);

    w.onmessage = event => {
        if (event.data === 'done') {
            resolve();
        } else {
            reject(new Error(`unexpected message from worker ${i}: ${event.data}`));
        }
    };
    w.onerror = event => {
        event.preventDefault();
        reject(new Error(`worker ${i} failed: ${event.message}`));
    };

    workers.push(w);
    pending.push(promise);
}

// No in-test timeout: the runner's TJS_TEST_TIMEOUT kills a hung test, and a
// fixed timer here is too tight under GC stress.
try {
    await Promise.all(pending);
} finally {
    for (const w of workers) {
        w.terminate();
    }
}

const { FFI, sopath } = await import('./helpers/ffi.js');
const { symbols, close } = FFI.dlopen(sopath, {
    simple_func1: { args: [ 'sint' ], returns: 'sint' },
});

assert.eq(symbols.simple_func1(41), 42, 'main runtime FFI works after the workers');
close();
