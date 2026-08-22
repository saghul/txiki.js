// Regression: a `memory.grow` instruction executed mid-call relocates and frees
// WAMR's linear-memory base. If an imported JS function runs later in the same
// call and touches a TypedArray captured over the pre-grow memory.buffer, it
// used to read/write freed memory (use-after-free). The import trampoline now
// detaches any cached buffer whose base/size changed before re-entering JS, so
// the stale view becomes inert (a detached TypedArray reads undefined and
// ignores writes) instead of aliasing freed memory.

import assert from 'tjs:assert';
import data from './wasm/memory-grow-import.wasm' with { type: 'bytes' };

let sawDetached = false;
let view;

const { instance } = await WebAssembly.instantiate(data, {
    env: {
        cb() {
            // `view` aliases the pre-grow buffer; run() has since grown memory.
            // Post-fix the buffer is detached here (length 0) and the write is a
            // silent no-op; pre-fix the view still aliased (now-freed) memory.
            sawDetached = view.length === 0;
            view[0] = 0x41;
        },
    },
});

const mem = instance.exports.memory;

view = new Uint8Array(mem.buffer);
assert.eq(view.length, 65536, 'initial memory is 1 page');

// Must not crash (no UAF): a successful grow always changes the byte length, so
// the cached buffer is detached before the callback runs on every platform.
instance.exports.run();

assert.ok(sawDetached, 'stale pre-grow view is detached inside the import callback');

// A freshly fetched buffer reflects the grown memory and stays usable.
const fresh = new Uint8Array(mem.buffer);
assert.eq(fresh.length, 17 * 65536, 'memory grew to 17 pages');
fresh[0] = 0x99;
assert.eq(fresh[0], 0x99, 'fresh buffer is writable');
