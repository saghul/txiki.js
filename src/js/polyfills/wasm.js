const core = globalThis[Symbol.for('tjs.internal.core')];
const wasm = core.wasm;

const kWasmModule = Symbol('kWasmModule');
const kWasmModuleRef = Symbol('kWasmModuleRef');
const kWasmExports = Symbol('kWasmExports');
const kWasmInstance = Symbol('kWasmInstance');
const kWasmMemoryInstance = Symbol('kWasmMemoryInstance');
const kWasmMemoryBuffer = Symbol('kWasmMemoryBuffer');


class CompileError extends Error {
    constructor(...args) {
        super(...args);
        this.name = 'CompileError';
    }
}

class LinkError extends Error {
    constructor(...args) {
        super(...args);
        this.name = 'LinkError';
    }
}

class RuntimeError extends Error {
    constructor(...args) {
        super(...args);
        this.name = 'RuntimeError';
    }
}


function getWasmError(e) {
    switch (e.wasmError) {
        case 'CompileError':
            return new CompileError(e.message);
        case 'LinkError':
            return new LinkError(e.message);
        case 'RuntimeError':
            return new RuntimeError(e.message);
        default:
            return new TypeError(`Invalid WASM error: ${e.wasmError}`);
    }
}

function callWasmFunction(name, ...args) {
    const instance = this;

    try {
        return instance.callFunction(name, ...args);
    } catch (e) {
        if (e.wasmError) {
            throw getWasmError(e);
        } else {
            throw e;
        }
    }
}

function buildInstance(mod) {
    try {
        return wasm.buildInstance(mod);
    } catch (e) {
        if (e.wasmError) {
            throw getWasmError(e);
        } else {
            throw e;
        }
    }
}

function parseModule(buf) {
    try {
        return wasm.parseModule(buf);
    } catch (e) {
        if (e.wasmError) {
            throw getWasmError(e);
        } else {
            throw e;
        }
    }
}

class Module {
    constructor(buf) {
        this[kWasmModule] =  parseModule(buf);
    }

    static exports(module) {
        return wasm.moduleExports(module[kWasmModule]);
    }

    // eslint-disable-next-line no-unused-vars
    static imports(module) {
        // TODO.
        return {};
    }
}

class Instance {
    constructor(module, importObject = {}) {
        // Detect WASI in importObject via duck typing and configure it before instantiation
        for (const ns of Object.values(importObject)) {
            if (ns && typeof ns === 'object' && typeof ns._configure === 'function') {
                ns._configure(module[kWasmModule]);
                break;
            }
        }

        const instance = buildInstance(module[kWasmModule]);

        const _exports = Module.exports(module);
        const exports = Object.create(null);

        for (const item of _exports) {
            if (item.kind === 'function') {
                exports[item.name] = callWasmFunction.bind(instance, item.name);
            } else if (item.kind === 'memory') {
                const mem = new Memory({ initial: 0 });
                mem[kWasmMemoryInstance] = instance;
                mem[kWasmMemoryBuffer] = null;
                exports[item.name] = mem;
            }
        }

        this[kWasmInstance] = instance;
        this[kWasmExports] = Object.freeze(exports);
        this[kWasmModuleRef] = module;
    }

    get exports() {
        return this[kWasmExports];
    }
}

const WASM_PAGE_SIZE = 65536;

class Memory {
    constructor(descriptor) {
        if (typeof descriptor !== 'object' || descriptor === null) {
            throw new TypeError('WebAssembly.Memory(): Argument 0 must be a memory descriptor');
        }

        const initial = descriptor.initial;

        if (initial === undefined) {
            throw new TypeError('WebAssembly.Memory(): Property \'initial\' is required');
        }

        if (typeof initial !== 'number' || initial < 0 || initial !== (initial >>> 0)) {
            throw new TypeError('WebAssembly.Memory(): Property \'initial\' must be a non-negative integer');
        }

        const maximum = descriptor.maximum;

        if (maximum !== undefined) {
            if (typeof maximum !== 'number' || maximum < 0 || maximum !== (maximum >>> 0)) {
                throw new TypeError('WebAssembly.Memory(): Property \'maximum\' must be a non-negative integer');
            }

            if (maximum < initial) {
                throw new RangeError('WebAssembly.Memory(): Property \'maximum\' must be >= \'initial\'');
            }
        }

        // Store the descriptor for standalone Memory objects (not yet backed by WASM instance).
        // The actual WAMR memory is created when the module is instantiated.
        // For standalone use, we create a plain ArrayBuffer.
        this[kWasmMemoryInstance] = null;
        this[kWasmMemoryBuffer] = new ArrayBuffer(initial * WASM_PAGE_SIZE);
        this._initial = initial;
        this._maximum = maximum;
    }

    get buffer() {
        if (this[kWasmMemoryInstance]) {
            // Backed by a WASM instance — get the live buffer
            return wasm.getMemoryBuffer(this[kWasmMemoryInstance]);
        }

        return this[kWasmMemoryBuffer];
    }

    grow(delta) {
        if (typeof delta !== 'number' || delta < 0 || delta !== (delta >>> 0)) {
            throw new TypeError('WebAssembly.Memory.grow(): Argument 0 must be a non-negative integer');
        }

        if (this[kWasmMemoryInstance]) {
            // Backed by a WASM instance
            return wasm.growMemory(this[kWasmMemoryInstance], delta);
        }

        // Standalone memory
        const oldByteLength = this[kWasmMemoryBuffer].byteLength;
        const oldPages = oldByteLength / WASM_PAGE_SIZE;
        const newPages = oldPages + delta;

        if (this._maximum !== undefined && newPages > this._maximum) {
            throw new RangeError('WebAssembly.Memory.grow(): Maximum memory size exceeded');
        }

        const newBuffer = new ArrayBuffer(newPages * WASM_PAGE_SIZE);
        new Uint8Array(newBuffer).set(new Uint8Array(this[kWasmMemoryBuffer]));
        this[kWasmMemoryBuffer] = newBuffer;

        return oldPages;
    }
}

class WebAssembly {
    Module = Module;
    Instance = Instance;
    Memory = Memory;
    CompileError = CompileError;
    LinkError = LinkError;
    RuntimeError = RuntimeError;

    async compile(src) {
        return new Module(src);
    }

    async instantiate(src, importObject) {
        const module = await this.compile(src);
        const instance = new Instance(module, importObject);

        return { module, instance };
    }
}


Object.defineProperty(globalThis, 'WebAssembly', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new WebAssembly()
});
