import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

const testlib = new FFI.Lib(sopath);

const simple_func1 = new FFI.CFunction(testlib.symbol('simple_func1'), FFI.types.sint, [FFI.types.sint]);
assert.eq(simple_func1.call(-9), -8);

const simple_func2 = new FFI.CFunction(testlib.symbol('simple_func2'), FFI.types.float, [FFI.types.float]);
assert.ok(Math.abs(simple_func2.call(98.9) - 99.9) < 0.00001);

const simple_func3 = new FFI.CFunction(testlib.symbol('simple_func3'), FFI.types.double, [FFI.types.double]);
assert.ok(Math.abs(simple_func3.call(98.9) - 99.9) < 0.00001);

const atoiF = new FFI.CFunction(testlib.symbol('parse_int'), FFI.types.sint, [FFI.types.string]);
assert.eq(atoiF.call("1234"), 1234);

const strerrorF = new FFI.CFunction(testlib.symbol('int_to_string'), FFI.types.string, [FFI.types.sint]);
assert.eq(strerrorF.call(345), "345");

const sprintfF3 = new FFI.CFunction(testlib.symbol('test_sprintf'), FFI.types.sint, [FFI.types.buffer, FFI.types.string, FFI.types.sint], 2);
const strbuf = new Uint8Array(15); // 14 byte string + null byte
assert.eq(sprintfF3.call(strbuf, 'printf test %d\n', 5), 14);
assert.eq(FFI.bufferToString(strbuf), 'printf test 5\n');

const strcatF = new FFI.CFunction(testlib.symbol('test_strcat'), FFI.types.string, [FFI.types.buffer, FFI.types.string]);
const strbuf2 = new Uint8Array(12);
strbuf2.set((new TextEncoder()).encode('part1:'));
assert.eq(strcatF.call(strbuf2, "part2"), "part1:part2");
assert.eq(FFI.bufferToString(strbuf2), "part1:part2");
