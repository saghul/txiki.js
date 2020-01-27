import { run, test } from './t.js';
import { f32ToHex, f64ToHex } from './floatops.js';
import { dirname, join } from '@tjs/path';

const thisFile = import.meta.url.slice(7);   // strip "file://"


test('WASM i32 ops', async t => {
    const data = await tjs.fs.readFile(join(dirname(thisFile), 'wasm', 'i32.wasm'));
    const { instance } = await WebAssembly.instantiate(data);
    const { exports } = instance;

    t.eq(exports.add(1, 2), 3, 'add works');
    t.eq(exports.add(1, -2), -1, 'add works with negatives');
    t.eq(exports.sub(1, 2), -1, 'sub works');
    t.eq(exports.sub(1, -2), 3, 'sub works with negatives');
    t.eq(exports.mul(2, 2), 4, 'mul works');
    t.eq(exports.mul(2, -2), -4, 'mul works with negatives');
    t.eq(exports.div_s(4, 2), 2, 'div_s works');
    try {
        exports.div_s(1, 0);
    } catch(e) {
        t.ok(e instanceof WebAssembly.RuntimeError, 'div_s divide by zero throws RuntimeError');
    }
    t.eq(exports.div_u(-1, -1), 1, 'div_u works');
    t.eq(exports.rem_s(5, 2), 1, 'rem_s works');
});

test('WASM i64 ops', async t => {
    const data = await tjs.fs.readFile(join(dirname(thisFile), 'wasm', 'i64.wasm'));
    const { instance } = await WebAssembly.instantiate(data);
    const { exports } = instance;

    t.eq(exports.add(1, 2), 3, 'add works');
    t.eq(exports.add(1, -2), -1, 'add works with negatives');
    t.eq(exports.add(1n, 2n), 3, 'add works with BigInt');
    t.eq(exports.sub(1, 2), -1, 'sub works');
    t.eq(exports.sub(1, -2), 3, 'sub works with negatives');
    t.eq(exports.mul(2, 2), 4, 'mul works');
    t.eq(exports.mul(2, -2), -4, 'mul works with negatives');
    t.eq(String(exports.mul(BigInt(Number.MAX_SAFE_INTEGER), 100n)), '900719925474099100', 'mul works with BigInt');
    t.eq(String(exports.mul(0x0123456789abcdefn, 0xfedcba9876543210n)), '2465395958572223728', 'mul works with BigInt 2');
    t.eq(exports.div_s(4, 2), 2, 'div_s works');
    try {
        exports.div_s(1, 0);
    } catch(e) {
        t.ok(e instanceof WebAssembly.RuntimeError, 'div_s divide by zero throws RuntimeError');
    }
    t.eq(exports.div_u(-1, -1), 1, 'div_u works');
    t.eq(exports.rem_s(5, 2), 1, 'rem_s works');
});

test('WASM f32 ops', async t => {
    const data = await tjs.fs.readFile(join(dirname(thisFile), 'wasm', 'f32.wasm'));
    const { instance } = await WebAssembly.instantiate(data);
    const { exports } = instance;

    t.eq(exports.add(f32ToHex('1.2'), f32ToHex('0.8')), 2, 'add works');
    const v = exports.add(f32ToHex('-0'), f32ToHex('-0'));
    t.ok(1 / v < 0, 'adding -0 works');
    t.eq(exports.add(0, f32ToHex('Infinity')), Infinity, '0 + Infinity works');
    t.eq(exports.add(0, f32ToHex('-Infinity')), -Infinity, '0 + -Infinity works');
    t.eq(exports.add(f32ToHex('-Infinity'), f32ToHex('Infinity')), NaN, '-Infinity + Infinity works');
});

test('WASM f64 ops', async t => {
    const data = await tjs.fs.readFile(join(dirname(thisFile), 'wasm', 'f64.wasm'));
    const { instance } = await WebAssembly.instantiate(data);
    const { exports } = instance;

    t.eq(exports.add(f64ToHex('1.2'), f64ToHex('0.8')), 2, 'add works');
    const v = exports.add(f64ToHex('-0'), f64ToHex('-0'));
    t.ok(1 / v < 0, 'adding -0 works');
    t.eq(exports.add(0, f64ToHex('Infinity')), Infinity, '0 + Infinity works');
    t.eq(exports.add(0, f64ToHex('-Infinity')), -Infinity, '0 + -Infinity works');
    t.eq(exports.add(f64ToHex('-Infinity'), f64ToHex('Infinity')), NaN, '-Infinity + Infinity works');
});

test('WASI', async t => {
    const args = [
        tjs.exepath(),
        join(dirname(thisFile), 'wasi', 'launcher.js'),
        'test.wasm'
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe' });
    const status = await proc.wait();
    const buf = new ArrayBuffer(4096);
    const nread = await proc.stdout.read(buf);
    t.ok(nread > 0, 'stdout was read');
    const data = new TextDecoder().decode(new Uint8Array(buf, 0, nread));
    t.ok(data.match(/Hello world/), 'data matches 1');
    t.ok(data.match(/Constructor OK/), 'data matches 2');
    t.ok(data.match(/Hello printf!/), 'data matches 3');
    t.ok(data.match(/fib\(20\)/), 'data matches 4');
    t.eq(status.exit_status, 0, 'WASI ran succesfully')
    t.eq(status.term_signal, 0, 'WASI ran succesfully 2')
});


if (import.meta.main) {
    run();
}
