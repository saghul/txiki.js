const core = globalThis[Symbol.for('tjs.internal.core')];
const wasm = core.wasm;

const kWasmModule = Symbol('kWasmModule');
const kWasmModuleRef = Symbol('kWasmModuleRef');
const kWasmExports = Symbol('kWasmExports');
const kWasmInstance = Symbol('kWasmInstance');
const kWasmMemoryInstance = Symbol('kWasmMemoryInstance');
const kWasmMemoryBuffer = Symbol('kWasmMemoryBuffer');
const kWasmGlobalInstance = Symbol('kWasmGlobalInstance');
const kWasmGlobalName = Symbol('kWasmGlobalName');
const kWasmGlobalType = Symbol('kWasmGlobalType');
const kWasmGlobalMutable = Symbol('kWasmGlobalMutable');
const kWasmGlobalValue = Symbol('kWasmGlobalValue');


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
            } else if (item.kind === 'global') {
                const info = wasm.getGlobalInfo(instance, item.name);
                const g = new Global({ value: info.type, mutable: info.mutable }, 0);
                g[kWasmGlobalInstance] = instance;
                g[kWasmGlobalName] = item.name;
                g[kWasmGlobalType] = info.type;
                g[kWasmGlobalMutable] = info.mutable;
                g[kWasmGlobalValue] = undefined;
                exports[item.name] = g;
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

const VALID_GLOBAL_TYPES = ['i32', 'i64', 'f32', 'f64'];

function coerceGlobalValue(type, v) {
    switch (type) {
        case 'i32':
            return v | 0;
        case 'i64':
            return BigInt.asIntN(64, typeof v === 'bigint' ? v : BigInt(v));
        case 'f32':
            return Math.fround(v);
        case 'f64':
            return +v;
    }
}

class Global {
    constructor(descriptor, value) {
        if (typeof descriptor !== 'object' || descriptor === null) {
            throw new TypeError('WebAssembly.Global(): Argument 0 must be a global descriptor');
        }

        const type = descriptor.value;

        if (!VALID_GLOBAL_TYPES.includes(type)) {
            throw new TypeError(`WebAssembly.Global(): Invalid type '${type}'`);
        }

        const mutable = Boolean(descriptor.mutable);

        this[kWasmGlobalInstance] = null;
        this[kWasmGlobalName] = null;
        this[kWasmGlobalType] = type;
        this[kWasmGlobalMutable] = mutable;
        this[kWasmGlobalValue] = coerceGlobalValue(type, value === undefined ? (type === 'i64' ? 0n : 0) : value);
    }

    get value() {
        if (this[kWasmGlobalInstance]) {
            return wasm.getGlobal(this[kWasmGlobalInstance], this[kWasmGlobalName]);
        }

        return this[kWasmGlobalValue];
    }

    set value(v) {
        if (!this[kWasmGlobalMutable]) {
            throw new TypeError('WebAssembly.Global.set(): Cannot set value of an immutable global');
        }

        if (this[kWasmGlobalInstance]) {
            wasm.setGlobal(this[kWasmGlobalInstance], this[kWasmGlobalName], v);
        } else {
            this[kWasmGlobalValue] = coerceGlobalValue(this[kWasmGlobalType], v);
        }
    }

    valueOf() {
        return this.value;
    }
}

class WebAssembly {
    Module = Module;
    Instance = Instance;
    Memory = Memory;
    Global = Global;
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
