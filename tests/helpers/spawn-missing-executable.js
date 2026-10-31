import assert from 'tjs:assert';

// A failed spawn must throw ENOENT and leave no freed handle on the loop, so
// the runtime tears down cleanly afterwards.
let err;

try {
    tjs.spawn([ '/definitely/not/a/real/executable' ], { stdout: 'pipe', stderr: 'pipe' });
} catch (e) {
    err = e;
}

assert.ok(err, 'spawn threw');
assert.eq(err.code, 'ENOENT');
console.log('spawn failed with ENOENT');
