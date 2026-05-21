// Regression: a successful WebAssembly.Memory grow must detach the previously
// handed-out ArrayBuffer so that prior TypedArray views can no longer alias
// linear memory whose owner (WAMR) may have moved or unmapped it.

import assert from 'tjs:assert';

// Minimal module exporting a single Memory of 1 page.
const wasmBytes = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    0x05, 0x04, 0x01, 0x01, 0x01, 0x0a,
    0x07, 0x07, 0x01, 0x03, 0x6d, 0x65, 0x6d, 0x02, 0x00,
]);

// JS-side grow detaches the buffer.
{
    const mod = new WebAssembly.Module(wasmBytes);
    const inst = new WebAssembly.Instance(mod, {});
    const mem = inst.exports.mem;

    const buf = mem.buffer;
    const view = new Uint8Array(buf);

    view[0] = 0x41;
    view[65535] = 0x42;

    mem.grow(8);

    assert.eq(buf.byteLength, 0, 'old buffer is detached after grow');
    assert.eq(view.byteLength, 0, 'stale view sees zero length');
    assert.eq(view[0], undefined, 'stale view reads return undefined');
    assert.eq(view[65535], undefined, 'stale view reads anywhere return undefined');

    // Writes through the stale view must not reach the new linear memory or
    // any unrelated mapping the OS may have placed at the old address.
    view[0] = 0xcc;
    const fresh = new Uint8Array(mem.buffer);
    assert.eq(fresh[0], 0x41, 'write via stale view does not affect new memory');
}

// Two independent Memory instances must remain isolated, even after one of
// them has been grown and its old buffer detached.
{
    const modA = new WebAssembly.Module(wasmBytes);
    const modB = new WebAssembly.Module(wasmBytes);
    const a = new WebAssembly.Instance(modA, {}).exports.mem;
    const b = new WebAssembly.Instance(modB, {}).exports.mem;

    const staleA = new Uint8Array(a.buffer);

    staleA[0] = 0xaa;
    a.grow(4);

    const freshB = new Uint8Array(b.buffer);

    freshB[0] = 0xbb;

    // Writes through the detached view must not bleed into b's memory.
    staleA[0] = 0xff;
    assert.eq(freshB[0], 0xbb, 'detached buffer cannot alias another Memory instance');
}

// grow(0) is a successful no-op but still detaches the existing buffer.
{
    const mod = new WebAssembly.Module(wasmBytes);
    const inst = new WebAssembly.Instance(mod, {});
    const mem = inst.exports.mem;

    const buf = mem.buffer;

    assert.eq(mem.grow(0), 1, 'grow(0) returns current page count');
    assert.eq(buf.byteLength, 0, 'grow(0) detaches the existing buffer');
    assert.isNot(mem.buffer, buf, 'buffer getter returns a new object after grow(0)');
}
