import assert from 'tjs:assert';
import { WASI } from 'tjs:wasi';

// Test version is required
let threwMissing = false;

try {
    new WASI({ args: [ 'test.wasm' ] });
} catch (e) {
    threwMissing = true;
    assert.ok(e instanceof TypeError, 'missing version throws TypeError');
    assert.ok(e.message.includes('version is required'), 'error message mentions version is required');
}

assert.ok(threwMissing, 'missing version should throw');

// Test wasi_snapshot_preview1
const wasi1 = new WASI({
    version: 'wasi_snapshot_preview1',
    args: [ 'test.wasm' ]
});
const importObj1 = wasi1.getImportObject();

assert.ok(importObj1.wasi_snapshot_preview1, 'preview1 version works');
assert.ok(!importObj1.wasi_unstable, 'preview1 does not have unstable namespace');

// Test wasi_unstable
const wasi2 = new WASI({
    version: 'wasi_unstable',
    args: [ 'test.wasm' ]
});
const importObj2 = wasi2.getImportObject();

assert.ok(importObj2.wasi_unstable, 'unstable version works');
assert.ok(!importObj2.wasi_snapshot_preview1, 'unstable does not have preview1 namespace');

// Test invalid version throws
let threwInvalid = false;

try {
    new WASI({ version: 'invalid_version' });
} catch (e) {
    threwInvalid = true;
    assert.ok(e instanceof TypeError, 'invalid version throws TypeError');
    assert.ok(e.message.includes('Unsupported WASI version'), 'error message mentions unsupported version');
}

assert.ok(threwInvalid, 'invalid version should throw');
