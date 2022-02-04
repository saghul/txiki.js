import assert from './assert.js';
import { path } from '@tjs/std';


(async () => {
    const data = await tjs.readFile(path.join(import.meta.dirname, 'wasm', 'f64.wasm'));
    const { instance } = await WebAssembly.instantiate(data);
    const { exports } = instance;

    assert.eq(exports.add(1.2, 0.8), 2, 'add works');
    const v = exports.add('-0', '-0');
    assert.ok(1 / v < 0, 'adding -0 works');
    assert.eq(exports.add(0, Infinity), Infinity, '0 + Infinity works');
    assert.eq(exports.add(0, -Infinity), -Infinity, '0 + -Infinity works');
    assert.eq(exports.add(-Infinity, Infinity), NaN, '-Infinity + Infinity works');
})();
