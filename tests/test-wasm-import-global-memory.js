import assert from 'tjs:assert';
import data from './wasm/import-global-memory.wasm' with { type: 'bytes' };

// Test 1: Global imports with plain numbers.
{
    const importObject = {
        env: {
            base_offset: 42,
            scale: 2.5,
            memory: new WebAssembly.Memory({ initial: 1 }),
        },
    };

    const { instance } = await WebAssembly.instantiate(data, importObject);
    const { exports } = instance;

    assert.eq(exports.get_base_offset(), 42, 'imported i32 global works');
    assert.eq(exports.get_scale(), 2.5, 'imported f64 global works');
    assert.eq(exports.scaled_offset(), 105.0, 'globals used together');
}

// Test 2: Global imports with WebAssembly.Global objects.
{
    const baseGlobal = new WebAssembly.Global({ value: 'i32', mutable: false }, 100);
    const scaleGlobal = new WebAssembly.Global({ value: 'f64', mutable: false }, 3.0);

    const importObject = {
        env: {
            base_offset: baseGlobal,
            scale: scaleGlobal,
            memory: new WebAssembly.Memory({ initial: 1 }),
        },
    };

    const { instance } = await WebAssembly.instantiate(data, importObject);
    const { exports } = instance;

    assert.eq(exports.get_base_offset(), 100, 'Global object i32 import works');
    assert.eq(exports.get_scale(), 3.0, 'Global object f64 import works');
    assert.eq(exports.scaled_offset(), 300.0, 'Global objects used together');
}

// Test 3: Memory import — shared buffer between JS and WASM.
{
    const memory = new WebAssembly.Memory({ initial: 1 });

    const importObject = {
        env: {
            base_offset: 0,
            scale: 1.0,
            memory,
        },
    };

    const { instance } = await WebAssembly.instantiate(data, importObject);
    const { exports } = instance;

    // Write from WASM, read from JS.
    exports.mem_store(0, 12345);
    const view = new Int32Array(memory.buffer);
    assert.eq(view[0], 12345, 'WASM write visible from JS via imported memory');

    // Write from JS, read from WASM.
    view[1] = 99999;
    assert.eq(exports.mem_load(4), 99999, 'JS write visible from WASM via imported memory');
}

// Test 4: Module.imports() lists global and memory imports.
{
    const module = new WebAssembly.Module(data);
    const imports = WebAssembly.Module.imports(module);

    const globalImports = imports.filter(i => i.kind === 'global');
    assert.eq(globalImports.length, 2, 'module has 2 global imports');

    const baseImport = globalImports.find(i => i.name === 'base_offset');
    assert.ok(baseImport, 'base_offset import found');
    assert.eq(baseImport.module, 'env', 'base_offset from env module');

    const memImports = imports.filter(i => i.kind === 'memory');
    assert.eq(memImports.length, 1, 'module has 1 memory import');
}

// Test 5: Missing global import throws LinkError.
{
    try {
        await WebAssembly.instantiate(data, {
            env: {
                memory: new WebAssembly.Memory({ initial: 1 }),
            },
        });
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.ok(e instanceof WebAssembly.LinkError, 'missing global throws LinkError');
    }
}

// Test 6: Invalid global import type throws LinkError.
{
    try {
        await WebAssembly.instantiate(data, {
            env: {
                base_offset: 'not a number',
                scale: 1.0,
                memory: new WebAssembly.Memory({ initial: 1 }),
            },
        });
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.ok(e instanceof WebAssembly.LinkError, 'non-numeric global throws LinkError');
    }
}
