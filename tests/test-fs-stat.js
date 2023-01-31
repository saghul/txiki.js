import assert from 'tjs:assert';
import path from 'tjs:path';


const st = await tjs.stat(path.join(import.meta.dirname, import.meta.basename));

assert.ok(st);
assert.ok(st.isFile, 'is a regular file');
