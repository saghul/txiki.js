import assert from './assert.js';
import { path } from '@tjs/std';


(async () => {
    const data = await tjs.readFile(path.join(import.meta.dirname, 'wasm', 'i64.wasm'));
    const { instance } = await WebAssembly.instantiate(data);
    const { exports } = instance;

    assert.eq(exports.add(1, 2), 3, 'add works');
    assert.eq(exports.add(1, -2), -1, 'add works with negatives');
    assert.eq(exports.add(1n, 2n), 3, 'add works with BigInt');
    assert.eq(exports.sub(1, 2), -1, 'sub works');
    assert.eq(exports.sub(1, -2), 3, 'sub works with negatives');
    assert.eq(exports.mul(2, 2), 4, 'mul works');
    assert.eq(exports.mul(2, -2), -4, 'mul works with negatives');
    assert.eq(String(exports.mul(BigInt(Number.MAX_SAFE_INTEGER), 100n)), '900719925474099100', 'mul works with BigInt');
    assert.eq(String(exports.mul(0x0123456789abcdefn, 0xfedcba9876543210n)), '2465395958572223728', 'mul works with BigInt 2');
    assert.eq(exports.div_s(4, 2), 2, 'div_s works');
    try {
        exports.div_s(1, 0);
    } catch(e) {
        assert.ok(e instanceof WebAssembly.RuntimeError, 'div_s divide by zero throws RuntimeError');
    }
    assert.eq(exports.div_u(-1, -1), 1, 'div_u works');
    assert.eq(exports.rem_s(5, 2), 1, 'rem_s works');
})();
