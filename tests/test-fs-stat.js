import assert from './assert.js';
import { path } from '@tjs/std';


(async () => {
    const st = await tjs.stat(path.join(import.meta.dirname, import.meta.basename));
    
    assert.ok(st);
    assert.eq(st.st_mode & tjs.S_IFREG, tjs.S_IFREG, 'is a regular file');
})();
