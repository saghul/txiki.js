import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

const { symbols, close } = FFI.dlopen(sopath, {
    simple_func1: { args: [ FFI.types.sint ], returns: FFI.types.sint },
    simple_func2: { args: [ FFI.types.float ], returns: FFI.types.float },
    simple_func3: { args: [ FFI.types.double ], returns: FFI.types.double },
    parse_int: { args: [ FFI.types.string ], returns: FFI.types.sint },
    int_to_string: { args: [ FFI.types.sint ], returns: FFI.types.string },
    test_sprintf: { args: [ FFI.types.buffer, FFI.types.string, FFI.types.sint ], returns: FFI.types.sint, fixed: 2 },
    test_strcat: { args: [ FFI.types.buffer, FFI.types.string ], returns: FFI.types.string },
});

assert.eq(symbols.simple_func1(-9), -8);

assert.ok(Math.abs(symbols.simple_func2(98.9) - 99.9) < 0.00001);

assert.ok(Math.abs(symbols.simple_func3(98.9) - 99.9) < 0.00001);

assert.eq(symbols.parse_int('1234'), 1234);

assert.eq(symbols.int_to_string(345), '345');

const strbuf = new Uint8Array(15); // 14 byte string + null byte
assert.eq(symbols.test_sprintf(strbuf, 'printf test %d\n', 5), 14);
assert.eq(FFI.bufferToString(strbuf), 'printf test 5\n');

const strbuf2 = new Uint8Array(12);
strbuf2.set((new TextEncoder()).encode('part1:'));
assert.eq(symbols.test_strcat(strbuf2, 'part2'), 'part1:part2');
assert.eq(FFI.bufferToString(strbuf2), 'part1:part2');

close();
