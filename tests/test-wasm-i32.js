import assert from './assert.js';
import { path } from '@tjs/std';


(async () => {
    const data = await tjs.readFile(path.join(import.meta.dirname, 'wasm', 'i32.wasm'));
    const { instance } = await WebAssembly.instantiate(data);
    const { exports } = instance;

    assert.eq(exports.add(1, 2), 3, 'add works');
    assert.eq(exports.add(1, -2), -1, 'add works with negatives');
    assert.eq(exports.sub(1, 2), -1, 'sub works');
    assert.eq(exports.sub(1, -2), 3, 'sub works with negatives');
    assert.eq(exports.mul(2, 2), 4, 'mul works');
    assert.eq(exports.mul(2, -2), -4, 'mul works with negatives');
    assert.eq(exports.div_s(4, 2), 2, 'div_s works');
    try {
        exports.div_s(1, 0);
    } catch(e) {
        assert.ok(e instanceof WebAssembly.RuntimeError, 'div_s divide by zero throws RuntimeError');
    }
    assert.eq(exports.div_u(-1, -1), 1, 'div_u works');
    assert.eq(exports.rem_s(5, 2), 1, 'rem_s works');
})();
