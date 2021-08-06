import assert from './assert.js';
import { dirname, join } from '@tjs/path';

const thisFile = import.meta.url.slice(7);   // strip "file://"


(async () => {
    const data = await tjs.fs.readFile(join(dirname(thisFile), 'wasm', 'multi.wasm'));
    const { instance } = await WebAssembly.instantiate(data);
    const { exports } = instance;

    const v = exports.round_trip_many(1, 5, 42);
    assert.ok(Array.isArray(v), 'return value is an array');
    assert.eq(v[0], 1, '1st arg matches');
    assert.eq(v[1], 5, '2nd arg matches');
    assert.eq(v[2], 42, '3rd arg matches');
})();
