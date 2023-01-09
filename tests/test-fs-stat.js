import path from '@tjs/std/path';
import assert from '@tjs/std/assert';


(async () => {
    const st = await tjs.stat(path.join(import.meta.dirname, import.meta.basename));
    
    assert.ok(st);
    assert.ok(st.isFile, 'is a regular file');
})();
