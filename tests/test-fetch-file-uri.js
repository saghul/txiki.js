import assert from 'tjs:assert';
import path from 'tjs:path';

const tmpDir = await tjs.makeTempDir(path.join(tjs.tmpDir, 'tjs-test-fetch-file-XXXXXX'));

// Test 1: Read a text file.
const textPath = path.join(tmpDir, 'hello.txt');

await tjs.writeFile(textPath, 'Hello World');

const r1 = await fetch(`file://${textPath}`);

assert.eq(r1.status, 200, 'text file status');
assert.ok(r1.ok, 'text file ok');
assert.eq(await r1.text(), 'Hello World', 'text file body');

// Test 2: Read a binary file.
const binPath = path.join(tmpDir, 'data.bin');
const binData = new Uint8Array([ 0x00, 0x01, 0x02, 0xFF ]);

await tjs.writeFile(binPath, binData);

const r2 = await fetch(`file://${binPath}`);
const buf = new Uint8Array(await r2.arrayBuffer());

assert.eq(buf.length, 4, 'binary file length');
assert.eq(buf[0], 0x00, 'binary byte 0');
assert.eq(buf[1], 0x01, 'binary byte 1');
assert.eq(buf[2], 0x02, 'binary byte 2');
assert.eq(buf[3], 0xFF, 'binary byte 3');

// Test 3: Read an empty file.
const emptyPath = path.join(tmpDir, 'empty.txt');

await tjs.writeFile(emptyPath, '');

const r3 = await fetch(`file://${emptyPath}`);

assert.eq(r3.status, 200, 'empty file status');
assert.eq(await r3.text(), '', 'empty file body');

// Test 4: Read a JSON file.
const jsonPath = path.join(tmpDir, 'data.json');

await tjs.writeFile(jsonPath, '{"key":"value"}');

const r4 = await fetch(`file://${jsonPath}`);

assert.deepEqual(await r4.json(), { key: 'value' }, 'json file body');

// Test 5: Non-existent file should throw TypeError.
try {
    await fetch(`file://${path.join(tmpDir, 'nope.txt')}`);
    assert.ok(false, 'should have thrown');
} catch (err) {
    assert.ok(err instanceof TypeError, 'non-existent file throws TypeError');
}

// Test 6: File path with percent-encoded characters.
const spacePath = path.join(tmpDir, 'hello world.txt');

await tjs.writeFile(spacePath, 'spaces work');

const spaceUrl = `file://${spacePath}`.replace(/ /g, '%20');
const r6 = await fetch(spaceUrl);

assert.eq(await r6.text(), 'spaces work', 'percent-encoded path body');

// Cleanup.
await tjs.remove(tmpDir, { recursive: true });
