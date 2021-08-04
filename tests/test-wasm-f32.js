import assert from './assert.js';
import { dirname, join } from '@tjs/path';

const thisFile = import.meta.url.slice(7);   // strip "file://"


(async () => {
    const data = await tjs.fs.readFile(join(dirname(thisFile), 'wasm', 'f32.wasm'));
    const { instance } = await WebAssembly.instantiate(data);
    const { exports } = instance;

    assert.eq(exports.add(1.2, 0.8), 2, 'add works');
    const v = exports.add('-0', '-0');
    assert.ok(1 / v < 0, 'adding -0 works');
    assert.eq(exports.add(0, Infinity), Infinity, '0 + Infinity works');
    assert.eq(exports.add(0, -Infinity), -Infinity, '0 + -Infinity works');
    assert.eq(exports.add(-Infinity, Infinity), NaN, '-Infinity + Infinity works');
})();
