import assert from 'tjs:assert';
import path from 'tjs:path';

let st;
let err;

try {
    st = await tjs.stat('a');
} catch (e) {
    err = e;
}

assert.eq(err.code, 'ENOENT', 'dir does not exist');
err = undefined;

await tjs.makeDir(path.join('a', 'b', 'c', 'd'), { recursive: true });

try {
    await tjs.makeDir('a');
} catch (e) {
    err = e;
}

assert.eq(err.code, 'EEXIST', 'dir does exist');
err = undefined;

await tjs.remove('a');

try {
    st = await tjs.stat('a');
} catch (e) {
    err = e;
}

assert.eq(err.code, 'ENOENT', 'dir does not exist');

// Now test with the full path.
await tjs.makeDir(path.join(tjs.cwd, 'a', 'b', 'c', 'd'), { recursive: true });

st = await tjs.stat('a');

assert.ok(st.isDirectory, 'it is a directory');

await tjs.remove('a');

try {
    st = await tjs.stat('a');
} catch (e) {
    err = e;
}

assert.eq(err.code, 'ENOENT', 'dir does not exist');
