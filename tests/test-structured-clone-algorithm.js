import assert from 'tjs:assert';

function throwsDataCloneError(fn, description) {
    let err;

    try {
        fn();
    } catch (e) {
        err = e;
    }

    assert.ok(err instanceof DOMException, description);
    assert.eq(err?.name, 'DataCloneError', description);
}

// Getters are invoked and their values copied.
const withGetter = structuredClone({ get g() {
    return 1;
}, x: 2 });

assert.eq(withGetter, { g: 1, x: 2 }, 'getter value is copied');
assert.eq(Object.getOwnPropertyDescriptor(withGetter, 'g').value, 1, 'getter becomes a data property');

// Errors.
const re = structuredClone(new RangeError('m'));

assert.ok(re instanceof RangeError, 'RangeError keeps its type');
assert.eq(re.message, 'm', 'error message is copied');

const custom = new TypeError('t');

custom.name = 'NotAStandardName';
assert.eq(Object.getPrototypeOf(structuredClone(custom)), Error.prototype, 'unknown error names become Error');
assert.eq(Object.hasOwn(structuredClone(new Error()), 'message'), false, 'missing message stays missing');

// Arrays keep holes and extra properties.
assert.eq(Object.keys(structuredClone([ , , 1 ])), [ '2' ], 'holes are preserved');
assert.eq(structuredClone([ , , 1 ]).length, 3, 'length is preserved');
assert.eq(Object.keys(structuredClone(Object.assign([ 1 ], { x: 2 }))), [ '0', 'x' ], 'extra array properties are kept');

// Symbols and other uncloneable values.
throwsDataCloneError(() => structuredClone(Symbol()), 'Symbol is rejected');
throwsDataCloneError(() => structuredClone(Object(Symbol())), 'Symbol object is rejected');
throwsDataCloneError(() => structuredClone({ s: Symbol('x') }), 'nested Symbol is rejected');
throwsDataCloneError(() => structuredClone(() => {}), 'function is rejected');
throwsDataCloneError(() => structuredClone({ f() {} }), 'nested function is rejected');
throwsDataCloneError(() => structuredClone(new WeakMap()), 'WeakMap is rejected');
throwsDataCloneError(() => structuredClone(Promise.resolve()), 'Promise is rejected');

// Blob and File.
const blob = structuredClone(new Blob([ 'ab' ], { type: 'text/plain' }));

assert.ok(blob instanceof Blob, 'Blob clone is a Blob');
assert.eq(blob.size, 2, 'Blob size');
assert.eq(blob.type, 'text/plain', 'Blob type');
assert.eq(await blob.text(), 'ab', 'Blob contents');

const file = structuredClone(new File([ 'abc' ], 'f.txt', { type: 'text/plain', lastModified: 42 }));

assert.ok(file instanceof File, 'File clone is a File');
assert.eq(file.name, 'f.txt', 'File name');
assert.eq(file.lastModified, 42, 'File lastModified');
assert.eq(await file.text(), 'abc', 'File contents');

// Built-in types and identity.
const date = new Date(1234);

assert.eq(structuredClone(date).getTime(), 1234, 'Date');
assert.eq(structuredClone(/a+/gi).source, 'a+', 'RegExp source');
assert.eq(structuredClone(/a+/gi).flags, 'gi', 'RegExp flags');
assert.eq(structuredClone(Object(1n)).valueOf(), 1n, 'BigInt object');
assert.eq(structuredClone(new Map([ [ 1, { a: 1 } ] ])).get(1), { a: 1 }, 'Map');
assert.ok(structuredClone(new Set([ 1, 2 ])).has(2), 'Set');

const shared = { a: 1 };
const twice = structuredClone({ x: shared, y: shared });

assert.is(twice.x, twice.y, 'shared references stay shared');

const cyclic = { name: 'c' };

cyclic.self = cyclic;

const cyclicClone = structuredClone(cyclic);

assert.is(cyclicClone.self, cyclicClone, 'cycles are preserved');

const protoKey = structuredClone(JSON.parse('{"__proto__": 1}'));

assert.eq(Object.getPrototypeOf(protoKey), Object.prototype, '__proto__ key does not set the prototype');
assert.eq(Object.getOwnPropertyDescriptor(protoKey, '__proto__').value, 1, '__proto__ key is copied');

// Views keep their offsets.
const buf = new ArrayBuffer(8);
const view = new Uint16Array(buf, 2, 2);
const dv = new DataView(buf, 1, 3);
const views = structuredClone({ view, dv });

assert.is(views.view.buffer, views.dv.buffer, 'views share the cloned buffer');
assert.eq(views.view.byteOffset, 2, 'typed array offset');
assert.eq(views.view.length, 2, 'typed array length');
assert.eq(views.dv.byteOffset, 1, 'DataView offset');
assert.eq(views.dv.byteLength, 3, 'DataView length');

const resizable = structuredClone(new ArrayBuffer(4, { maxByteLength: 16 }));

assert.ok(resizable.resizable, 'resizable ArrayBuffer stays resizable');
assert.eq(resizable.maxByteLength, 16, 'maxByteLength');

const detached = new ArrayBuffer(4);

structuredClone(undefined, { transfer: [ detached ] });
throwsDataCloneError(() => structuredClone(detached), 'detached ArrayBuffer is rejected');

const err = new Error('with stack');
const errClone = structuredClone(err);

assert.eq(errClone.stack, err.stack, 'error stack is kept');
assert.eq(Object.keys(errClone), [], 'error clone has no enumerable properties');
