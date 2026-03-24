import assert from 'tjs:assert';
import data from './wasm/import.wasm' with { type: 'bytes' };

// Track calls to the log function.
const logCalls = [];

const importObject = {
    env: {
        add: (a, b) => a + b,
        log: (v) => { logCalls.push(v); },
    },
    math: {
        mul: (a, b) => a * b,
    },
};

const { instance } = await WebAssembly.instantiate(data, importObject);
const { exports } = instance;

// Basic function import: add.
assert.eq(exports.call_add(3, 4), 7, 'imported add works');
assert.eq(exports.call_add(100, -50), 50, 'imported add with negative');
assert.eq(exports.call_add(0, 0), 0, 'imported add with zeros');

// Void function import: log.
exports.call_log(42);
assert.eq(logCalls.length, 1, 'log called once');
assert.eq(logCalls[0], 42, 'log received correct value');

// Multiple import modules.
const result = exports.call_mul(3.0, 4.5);
assert.eq(result, 13.5, 'imported mul from different module works');

// Chained imports: add_and_log calls both add and log.
const sum = exports.add_and_log(10, 20);
assert.eq(sum, 30, 'add_and_log returns sum');
assert.eq(logCalls.length, 2, 'log called again');
assert.eq(logCalls[1], 30, 'log received the sum');

// Module.imports() should list the imports.
const module = new WebAssembly.Module(data);
const imports = WebAssembly.Module.imports(module);
assert.eq(imports.length, 3, 'module has 3 imports');

const envAdd = imports.find(i => i.module === 'env' && i.name === 'add');
assert.ok(envAdd, 'env.add import found');
assert.eq(envAdd.kind, 'function', 'env.add is a function');

const mathMul = imports.find(i => i.module === 'math' && i.name === 'mul');
assert.ok(mathMul, 'math.mul import found');
assert.eq(mathMul.kind, 'function', 'math.mul is a function');

// JS exception propagation: imported function throws.
{
    const throwImports = {
        env: {
            add: () => { throw new RangeError('custom error from JS'); },
            log: () => {},
        },
        math: {
            mul: () => 0,
        },
    };
    const { instance: inst2 } = await WebAssembly.instantiate(data, throwImports);
    try {
        inst2.exports.call_add(1, 2);
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.ok(e instanceof RangeError, 'original JS error type preserved');
        assert.eq(e.message, 'custom error from JS', 'original JS error message preserved');
    }
}

// Import validation: missing import module.
try {
    await WebAssembly.instantiate(data, {});
    assert.ok(false, 'should have thrown');
} catch (e) {
    assert.ok(e instanceof WebAssembly.LinkError, 'missing module throws LinkError');
}

// Import validation: missing import function.
try {
    await WebAssembly.instantiate(data, { env: { add: () => {} }, math: {} });
    assert.ok(false, 'should have thrown');
} catch (e) {
    assert.ok(e instanceof WebAssembly.LinkError, 'missing function throws LinkError');
}
