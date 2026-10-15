import { FFI, sopath } from './ffi.js';

// Loaded by test-worker-ffi-classes.js: the FFI native classes are registered
// for the first time here, inside a Worker runtime.
const ITERATIONS = 200;

for (let i = 0; i < ITERATIONS; i++) {
    const { symbols, close } = FFI.dlopen(sopath, {
        simple_func1: { args: [ 'sint' ], returns: 'sint' },
    });
    const r = symbols.simple_func1(i);

    if (r !== i + 1) {
        throw new Error(`simple_func1(${i}) returned ${r}`);
    }

    // Close half of the libs explicitly; leave the rest to the GC.
    if (i % 2 === 0) {
        close();
    }
}

tjs.engine.gc.run();

self.postMessage('done');
