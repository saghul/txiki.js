import assert from 'tjs:assert';
import path from 'tjs:path';
import { FFI, sopath } from './helpers/ffi.js';

// A native pointer survives a trip to a worker when sent as its `.value`
// (a BigInt) and rebuilt with createPointer() on the other side — the address
// is valid across threads of the same process.
const testlib = new FFI.Lib(sopath);
const ptr = testlib.symbol('simple_func1').addr;

const { promise, resolve, reject } = Promise.withResolvers();

const w = new Worker(path.join(import.meta.dirname, 'helpers', 'ffi-pointer-worker.js'));
const timer = setTimeout(() => {
    w.terminate();
    reject(new Error('Timed out waiting for worker'));
}, 5000);

w.onmessage = event => {
    clearTimeout(timer);
    w.terminate();
    try {
        assert.eq(event.data.addr, ptr.value, 'worker reconstructed the same address');
        assert.eq(event.data.str, ptr.toString(), 'worker reconstructed the same hex address');
        resolve();
    } catch (err) {
        reject(err);
    }
};
w.onmessageerror = event => {
    clearTimeout(timer);
    w.terminate();
    reject(new Error(`messageerror from worker: ${event}`));
};

w.postMessage({ addr: ptr.value });

await promise;
testlib.close();
