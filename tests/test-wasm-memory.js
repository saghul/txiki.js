import assert from 'tjs:assert';
import data from './wasm/memory.wasm' with { type: 'bytes' };


const { instance } = await WebAssembly.instantiate(data);
const { exports } = instance;

// Memory should be exported.
assert.ok(exports.memory instanceof WebAssembly.Memory, 'memory export is a Memory instance');

// Buffer should be an ArrayBuffer with the right size (1 page = 64KB).
const buf = exports.memory.buffer;
assert.ok(buf instanceof ArrayBuffer, 'buffer is an ArrayBuffer');
assert.eq(buf.byteLength, 65536, 'initial size is 1 page');
assert.is(exports.memory.buffer, buf, 'buffer getter returns the same object while no grow has occurred');

// Write via WASM, read from JS.
exports.store_i32(0, 42);
const view = new DataView(exports.memory.buffer);
assert.eq(view.getInt32(0, true), 42, 'JS can read WASM memory');

// Write from JS, read via WASM.
view.setInt32(4, 123, true);
assert.eq(exports.load_i32(4), 123, 'WASM can read JS writes');

// Byte-level access.
exports.store_i8(100, 0xff);
const bytes = new Uint8Array(exports.memory.buffer);
assert.eq(bytes[100], 0xff, 'byte access works');

// Memory size query via WASM.
assert.eq(exports.mem_size(), 1, 'WASM reports 1 page');

// Grow from JS side detaches any prior buffer (the underlying linear memory
// may move; aliasing views must not keep dereferencing the old base).
const staleView = new Uint8Array(buf);
const oldPages = exports.memory.grow(2);
assert.eq(oldPages, 1, 'grow returns old page count');
assert.eq(buf.byteLength, 0, 'old buffer is detached after JS-side grow');
assert.throws(() => new Uint8Array(buf), TypeError, 'detached buffer cannot be viewed');
assert.eq(staleView.byteLength, 0, 'TypedArray over detached buffer has zero length');
assert.eq(staleView[0], undefined, 'reads through stale view return undefined');
assert.eq(exports.memory.buffer.byteLength, 3 * 65536, 'buffer grew to 3 pages');
assert.eq(exports.mem_size(), 3, 'WASM sees grown memory');

// Data survives grow.
const viewAfter = new DataView(exports.memory.buffer);
assert.eq(viewAfter.getInt32(0, true), 42, 'data survives grow');

// Grow from WASM side.
const beforeWasmGrow = exports.memory.buffer;
const staleViewWasm = new Uint8Array(beforeWasmGrow);
const wasmOldPages = exports.mem_grow(1);
assert.eq(wasmOldPages, 3, 'WASM grow returns old page count');
assert.eq(beforeWasmGrow.byteLength, 0, 'old buffer is detached after WASM-side grow');
assert.throws(() => new Uint8Array(beforeWasmGrow), TypeError, 'detached buffer cannot be viewed');
assert.eq(staleViewWasm.byteLength, 0, 'TypedArray over WASM-detached buffer has zero length');
assert.eq(exports.memory.buffer.byteLength, 4 * 65536, 'JS sees WASM-side grow');

// grow(0) is a successful no-op but still detaches the existing buffer.
const beforeZeroGrow = exports.memory.buffer;
const zeroOld = exports.memory.grow(0);
assert.eq(zeroOld, 4, 'grow(0) returns the current page count');
assert.eq(beforeZeroGrow.byteLength, 0, 'grow(0) detaches the previous buffer');
assert.eq(exports.memory.buffer.byteLength, 4 * 65536, 'memory size unchanged after grow(0)');

// Standalone Memory.
const mem = new WebAssembly.Memory({ initial: 2, maximum: 4 });
assert.ok(mem.buffer instanceof ArrayBuffer, 'standalone buffer is ArrayBuffer');
assert.eq(mem.buffer.byteLength, 2 * 65536, 'standalone initial size');

const oldStandalone = mem.grow(1);
assert.eq(oldStandalone, 2, 'standalone grow returns old pages');
assert.eq(mem.buffer.byteLength, 3 * 65536, 'standalone grew');

// Standalone: exceeding maximum.
try {
    mem.grow(10);
    assert.ok(false, 'should have thrown');
} catch (e) {
    assert.ok(e instanceof RangeError, 'exceeding maximum throws RangeError');
}

// Constructor validation.
try {
    new WebAssembly.Memory();
    assert.ok(false, 'should have thrown');
} catch (e) {
    assert.ok(e instanceof TypeError, 'missing descriptor throws TypeError');
}

try {
    new WebAssembly.Memory({});
    assert.ok(false, 'should have thrown');
} catch (e) {
    assert.ok(e instanceof TypeError, 'missing initial throws TypeError');
}

try {
    new WebAssembly.Memory({ initial: 5, maximum: 2 });
    assert.ok(false, 'should have thrown');
} catch (e) {
    assert.ok(e instanceof RangeError, 'maximum < initial throws RangeError');
}
