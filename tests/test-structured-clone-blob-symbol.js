import assert from 'tjs:assert';

// A top-level symbol can't be cloned.
assert.throws(() => structuredClone(Symbol('s')), DOMException);

try {
    structuredClone(Symbol());
} catch (e) {
    assert.eq(e.name, 'DataCloneError');
}

// A top-level Blob is cloned as a Blob with the same data and type.
const blob = new Blob([ 'ab' ], { type: 'text/plain' });
const blobClone = structuredClone(blob);

assert.ok(blobClone instanceof Blob);
assert.isNot(blobClone, blob);
assert.eq(blobClone.size, 2);
assert.eq(blobClone.type, 'text/plain');
assert.eq(await blobClone.text(), 'ab');

// Same for a File, which also keeps its name and lastModified.
const file = new File([ 'xyz' ], 'a.txt', { type: 'text/plain', lastModified: 1234 });
const fileClone = structuredClone(file);

assert.ok(fileClone instanceof File);
assert.eq(fileClone.name, 'a.txt');
assert.eq(fileClone.lastModified, 1234);
assert.eq(fileClone.type, 'text/plain');
assert.eq(await fileClone.text(), 'xyz');

// Transfers still work alongside a Blob.
const ab = new ArrayBuffer(8);

structuredClone(blob, { transfer: [ ab ] });
assert.ok(ab.detached);
