import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';


function testBasicDispose() {
    let libRef;

    {
        using lib = new FFI.Lib(sopath);

        // The library should be usable inside the scope.
        const sym = lib.symbol('simple_func1');

        assert.ok(sym);
        assert.ok(sym.addr);

        libRef = lib;
    }

    // After scope exit, the underlying handle is closed.
    // Calling symbol() on the closed lib should throw.
    assert.throws(() => libRef.symbol('simple_func1'), Error, 'closed lib throws on symbol');
}

function testManualCloseThenDispose() {
    let libRef;

    {
        using lib = new FFI.Lib(sopath);

        lib.close(); // explicit close
        libRef = lib;
    }

    // Disposing after a manual close should be a no-op (idempotent).
    assert.throws(() => libRef.symbol('simple_func1'), Error);
}

function testDisposeSymbolPresent() {
    const lib = new FFI.Lib(sopath);

    assert.eq(typeof lib[Symbol.dispose], 'function');

    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(lib), Symbol.dispose);

    assert.ok(descriptor);
    assert.eq(descriptor.enumerable, false);
    assert.eq(descriptor.writable, true);
    assert.eq(descriptor.configurable, true);

    lib.close();
}

testBasicDispose();
testManualCloseThenDispose();
testDisposeSymbolPresent();
