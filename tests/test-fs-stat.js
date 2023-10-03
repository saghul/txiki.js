import assert from 'tjs:assert';


const st = await tjs.stat(import.meta.path);

assert.ok(st);
assert.ok(st.isFile, 'is a regular file');
