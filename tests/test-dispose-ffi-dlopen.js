import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

const decl = { simple_func1: { args: [ 'int' ], returns: 'int' } };

function testBasicDispose() {
    let libRef;

    {
        using lib = FFI.dlopen(sopath, decl);

        // The library should be usable inside the scope.
        assert.eq(lib.symbols.simple_func1(41), 42);

        libRef = lib;
    }

    // The scope exit closed the handle; closing it again is a no-op rather than
    // an error. (That the handle really went away is not observable from JS:
    // nothing hands out symbols from an already-open library any more.)
    libRef.close();
}

function testManualCloseThenDispose() {
    using lib = FFI.dlopen(sopath, decl);

    lib.close(); // explicit close, the scope exit disposes again
}

function testDisposeSymbolPresent() {
    const lib = FFI.dlopen(sopath, decl);

    assert.eq(typeof lib[Symbol.dispose], 'function');
    assert.eq(lib[Symbol.dispose], lib.close, 'dispose is an alias for close');

    const descriptor = Object.getOwnPropertyDescriptor(lib, Symbol.dispose);

    assert.ok(descriptor);
    assert.eq(descriptor.enumerable, false);
    assert.eq(descriptor.writable, true);
    assert.eq(descriptor.configurable, true);

    lib.close();
}

function testCProtoDispose() {
    using lib = FFI.dlopenCProto(sopath, 'int simple_func1(int a);');

    assert.eq(typeof lib[Symbol.dispose], 'function');
    assert.eq(lib.symbols.simple_func1(41), 42);
}

testBasicDispose();
testManualCloseThenDispose();
testDisposeSymbolPresent();
testCProtoDispose();
