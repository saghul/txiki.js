import assert from 'tjs:assert';
import path from 'tjs:path';

let st;
let err;

try {
    st = await tjs.stat('a');
} catch (e) {
    err = e;
}

assert.eq(err.errno, tjs.Error.ENOENT, 'dir does not exist');
err = undefined;

await tjs.mkdir(path.join('a', 'b', 'c', 'd'), { recursive: true });

try {
    await tjs.mkdir('a');
} catch (e) {
    err = e;
}

assert.eq(err.errno, tjs.Error.EEXIST, 'dir does exist');
err = undefined;

await tjs.rm('a');

try {
    st = await tjs.stat('a');
} catch (e) {
    err = e;
}

assert.eq(err.errno, tjs.Error.ENOENT, 'dir does not exist');
