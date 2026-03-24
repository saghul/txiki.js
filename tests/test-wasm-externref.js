import assert from 'tjs:assert';
import data from './wasm/externref.wasm' with { type: 'bytes' };


// Test 1: externref passthrough via exported functions.
{
    const { instance } = await WebAssembly.instantiate(data);
    const { exports } = instance;

    // Pass JS objects through WASM and get them back.
    const obj = { hello: 'world', num: 42 };
    const result = exports.passthrough(obj);
    assert.eq(result, obj, 'externref passthrough preserves identity');

    // Pass various JS types.
    const arr = [ 1, 2, 3 ];
    assert.eq(exports.passthrough(arr), arr, 'array passthrough');

    const str = 'test string';
    assert.eq(exports.passthrough(str), str, 'string passthrough');

    assert.eq(exports.passthrough(null), null, 'null passthrough');
}

// Test 2: externref global.
{
    const { instance } = await WebAssembly.instantiate(data);
    const { exports } = instance;

    // Initial value is null.
    assert.eq(exports.get_ref(), null, 'initial externref global is null');

    // Set and get a JS object.
    const obj = { key: 'value' };
    exports.set_ref(obj);
    const retrieved = exports.get_ref();
    assert.eq(retrieved, obj, 'externref global round-trip');

    // Set back to null.
    exports.set_ref(null);
    assert.eq(exports.get_ref(), null, 'externref global set to null');
}

// Test 3: externref table via JS Table API.
{
    const { instance } = await WebAssembly.instantiate(data);
    const { exports } = instance;

    assert.ok(exports.refs instanceof WebAssembly.Table, 'externref table export');
    assert.eq(exports.refs.length, 4, 'externref table has 4 slots');

    // All slots initially null.
    for (let i = 0; i < 4; i++) {
        assert.eq(exports.refs.get(i), null, `slot ${i} initially null`);
    }

    // Set and get via JS Table API.
    const obj1 = { id: 1 };
    const obj2 = [ 'a', 'b' ];
    exports.refs.set(0, obj1);
    exports.refs.set(1, obj2);

    assert.eq(exports.refs.get(0), obj1, 'externref table get after JS set');
    assert.eq(exports.refs.get(1), obj2, 'externref table get after JS set');

    // Set via WASM function, get via JS.
    const obj3 = { from: 'wasm' };
    exports.table_set(2, obj3);
    assert.eq(exports.refs.get(2), obj3, 'JS get after WASM set');

    // Set via JS, get via WASM function.
    const obj4 = { from: 'js' };
    exports.refs.set(3, obj4);
    assert.eq(exports.table_get(3), obj4, 'WASM get after JS set');

    // Clear a slot.
    exports.refs.set(0, null);
    assert.eq(exports.refs.get(0), null, 'set null clears slot');
}

// NOTE: externref in imported functions is not currently supported due to
// WAMR bugs in invoke_native_raw for externref params. This can be added
// once WAMR fixes the issue upstream.

// Test 4: WebAssembly.validate().
{
    assert.ok(WebAssembly.validate(data), 'valid wasm returns true');
    assert.ok(!WebAssembly.validate(new Uint8Array([ 0, 1, 2, 3 ])), 'invalid wasm returns false');
    assert.ok(!WebAssembly.validate(new Uint8Array(0)), 'empty buffer returns false');
}
