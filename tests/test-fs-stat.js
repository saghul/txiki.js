import assert from './assert.js';
import { path } from '@tjs/std';


(async () => {
    const st = await tjs.stat(path.join(import.meta.dirname, import.meta.basename));
    
    assert.ok(st);
    assert.ok(st.isFile, 'is a regular file');
})();
