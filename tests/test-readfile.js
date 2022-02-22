import assert from './assert.js';
import { path } from '@tjs/std';


(async () => {
    const data = await tjs.readFile(path.join(import.meta.dirname, import.meta.basename));

    assert.eq(data[Symbol.toStringTag], 'Uint8Array', 'returns Uint8Array');
})();
