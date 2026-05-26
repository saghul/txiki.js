import core from 'tjs:internal/core';
const wasm = core.wasm;

// Symbol-keyed hook table that tjs:wasi attaches to its import namespace. Shared
// via the global registry since the WASI implementation lives in another bundle.
const kWasiHooks = Symbol.for('tjs.wasi.hooks');

function getWasiHooks(ns) {
    return ns && typeof ns === 'object' ? ns[kWasiHooks] : undefined;
}

// Track the WAMR function index for callable wrappers returned from exports /
// table reads. We cannot add a `#private` field to a plain function, so a
// WeakMap keyed by the wrapper function is used instead.
const funcIndexMap = new WeakMap();

// Module-private invokers, captured from inside each class so Instance can
// reach the corresponding `#private` method without exposing it.
let getNativeModule;
let bindMemory;
let bindGlobal;
let bindTable;


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

function callWasmFuncByIndex(instance, funcIndex, ...args) {
    try {
        return wasm.callFuncByIndex(instance, funcIndex, ...args);
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
    #module;

    constructor(buf) {
        this.#module = parseModule(buf);
    }

    static {
        getNativeModule = m => m.#module;
    }

    static exports(module) {
        return wasm.moduleExports(module.#module);
    }

    static imports(module) {
        return wasm.moduleImports(module.#module);
    }
}

/* Import support limitations:
 * - Table imports are not supported.
 * - externref/funcref params and returns in imported functions are not
 *   supported due to WAMR bugs in invoke_native_raw for externref.
 *   externref works fine for exported functions, globals, and tables.
 * - Instantiating the same Module with different importObjects reuses
 *   the first set of imports (WAMR resolves imports at the module level).
 *   Use WebAssembly.instantiate(bytes, imports) to get independent instances.
 * - Multi-value returns from imported functions are not supported.
 */
class Instance {
    #instance;
    #exports;
    #moduleRef;

    constructor(module, importObject = {}) {
        const nativeModule = getNativeModule(module);

        // Detect a WASI import via its symbol-keyed hook table and configure it
        // before instantiation.
        let wasiHooks = null;

        for (const ns of Object.values(importObject)) {
            const hooks = getWasiHooks(ns);

            if (hooks) {
                hooks.configure(nativeModule);
                wasiHooks = hooks;
                break;
            }
        }

        // Validate and collect imports from importObject
        const moduleImports = Module.imports(module);
        const funcDescs = [];
        const globalDescs = [];
        const memoryImports = [];

        for (const imp of moduleImports) {
            const ns = importObject[imp.module];

            // Skip WASI imports (resolved by WAMR internally)
            if (!ns || typeof ns !== 'object') {
                if (imp.module.startsWith('wasi_')) {
                    continue;
                }

                throw new LinkError(`WebAssembly.Instance(): Import #${imp.module}#${imp.name} module not found`);
            }

            // Skip WASI namespaces (resolved by WAMR internally)
            if (getWasiHooks(ns)) {
                continue;
            }

            const value = ns[imp.name];

            if (imp.kind === 'function') {
                if (typeof value !== 'function') {
                    throw new LinkError(`WebAssembly.Instance(): Import #${imp.module}#${imp.name} is not a function`);
                }

                funcDescs.push({ module: imp.module, name: imp.name, func: value });
            } else if (imp.kind === 'global') {
                let numValue;

                if (value instanceof Global) {
                    numValue = value.value;
                } else if (typeof value === 'number' || typeof value === 'bigint') {
                    numValue = value;
                } else {
                    throw new LinkError(`WebAssembly.Instance(): Import #${imp.module}#${imp.name} is not a global`);
                }

                globalDescs.push({ module: imp.module, name: imp.name, value: numValue });
            } else if (imp.kind === 'memory') {
                if (!(value instanceof Memory)) {
                    throw new LinkError(`WebAssembly.Instance(): Import #${imp.module}#${imp.name} is not a memory`);
                }

                memoryImports.push(value);
            }
        }

        // Register function imports before instantiation
        if (funcDescs.length > 0) {
            try {
                wasm.resolveImports(nativeModule, funcDescs);
            } catch (e) {
                if (e.wasmError) {
                    throw getWasmError(e);
                } else {
                    throw e;
                }
            }
        }

        // Resolve global imports before instantiation
        if (globalDescs.length > 0) {
            try {
                wasm.resolveGlobalImports(nativeModule, globalDescs);
            } catch (e) {
                if (e.wasmError) {
                    throw getWasmError(e);
                } else {
                    throw e;
                }
            }
        }

        const instance = buildInstance(nativeModule);

        // Wire up imported Memory objects to the WAMR instance
        for (const mem of memoryImports) {
            bindMemory(mem, instance);
        }

        if (wasiHooks) {
            wasiHooks.postInstantiate(instance);
        }

        const _exports = Module.exports(module);
        const exports = Object.create(null);

        for (const item of _exports) {
            if (item.kind === 'function') {
                const fn = callWasmFunction.bind(instance, item.name);
                const funcIdx = wasm.getFuncIndex(instance, item.name);

                if (funcIdx >= 0) {
                    funcIndexMap.set(fn, funcIdx);
                }

                exports[item.name] = fn;
            } else if (item.kind === 'memory') {
                const mem = new Memory({ initial: 0 });

                bindMemory(mem, instance);
                exports[item.name] = mem;
            } else if (item.kind === 'global') {
                const info = wasm.getGlobalInfo(instance, item.name);
                const gType = VALID_GLOBAL_TYPES.includes(info.type) ? info.type : 'i32';
                const g = new Global({ value: gType, mutable: info.mutable }, 0);

                bindGlobal(g, instance, item.name, info.type, info.mutable);
                exports[item.name] = g;
            } else if (item.kind === 'table') {
                const info = wasm.getTableInfo(instance, item.name);
                const tbl = new Table({ element: info.element, initial: 0 });

                bindTable(tbl, instance, item.name);
                exports[item.name] = tbl;
            }
        }

        this.#instance = instance;
        this.#exports = Object.freeze(exports);
        this.#moduleRef = module;
    }

    get exports() {
        return this.#exports;
    }
}

const WASM_PAGE_SIZE = 65536;

class Memory {
    #instance = null;
    #buffer;
    #initial;
    #maximum;

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

        // For standalone Memory objects (not yet backed by a WASM instance),
        // back it with a plain ArrayBuffer. bindMemory() flips it over to
        // using the WAMR-managed memory.
        this.#buffer = new ArrayBuffer(initial * WASM_PAGE_SIZE);
        this.#initial = initial;
        this.#maximum = maximum;
    }

    static {
        bindMemory = (mem, instance) => {
            mem.#instance = instance;
            mem.#buffer = null;
        };
    }

    get buffer() {
        if (this.#instance) {
            return wasm.getMemoryBuffer(this.#instance);
        }

        return this.#buffer;
    }

    grow(delta) {
        if (typeof delta !== 'number' || delta < 0 || delta !== (delta >>> 0)) {
            throw new TypeError('WebAssembly.Memory.grow(): Argument 0 must be a non-negative integer');
        }

        if (this.#instance) {
            return wasm.growMemory(this.#instance, delta);
        }

        // Standalone memory
        const oldByteLength = this.#buffer.byteLength;
        const oldPages = oldByteLength / WASM_PAGE_SIZE;
        const newPages = oldPages + delta;

        if (this.#maximum !== undefined && newPages > this.#maximum) {
            throw new RangeError('WebAssembly.Memory.grow(): Maximum memory size exceeded');
        }

        const newBuffer = new ArrayBuffer(newPages * WASM_PAGE_SIZE);

        new Uint8Array(newBuffer).set(new Uint8Array(this.#buffer));
        this.#buffer = newBuffer;

        return oldPages;
    }
}

const VALID_GLOBAL_TYPES = [ 'i32', 'i64', 'f32', 'f64' ];

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
        default:
            return v;
    }
}

class Global {
    #instance = null;
    #name = null;
    #type;
    #mutable;
    #value;

    constructor(descriptor, value) {
        if (typeof descriptor !== 'object' || descriptor === null) {
            throw new TypeError('WebAssembly.Global(): Argument 0 must be a global descriptor');
        }

        const type = descriptor.value;
        const allTypes = [ ...VALID_GLOBAL_TYPES, 'externref', 'funcref' ];

        if (!allTypes.includes(type)) {
            throw new TypeError(`WebAssembly.Global(): Invalid type '${type}'`);
        }

        const mutable = Boolean(descriptor.mutable);

        this.#type = type;
        this.#mutable = mutable;
        let initialValue;

        if (value !== undefined) {
            initialValue = value;
        } else if (type === 'i64') {
            initialValue = 0n;
        } else if (type === 'externref' || type === 'funcref') {
            initialValue = null;
        } else {
            initialValue = 0;
        }

        this.#value = coerceGlobalValue(type, initialValue);
    }

    static {
        bindGlobal = (g, instance, name, type, mutable) => {
            g.#instance = instance;
            g.#name = name;
            g.#type = type;
            g.#mutable = mutable;
            g.#value = undefined;
        };
    }

    get value() {
        if (this.#instance) {
            return wasm.getGlobal(this.#instance, this.#name);
        }

        return this.#value;
    }

    set value(v) {
        if (!this.#mutable) {
            throw new TypeError('WebAssembly.Global.set(): Cannot set value of an immutable global');
        }

        if (this.#instance) {
            wasm.setGlobal(this.#instance, this.#name, v);
        } else {
            this.#value = coerceGlobalValue(this.#type, v);
        }
    }

    valueOf() {
        return this.value;
    }
}

const VALID_TABLE_ELEMENTS = [ 'anyfunc', 'funcref', 'externref' ];

class Table {
    #instance = null;
    #name = null;
    #element;

    constructor(descriptor, _value) {
        if (typeof descriptor !== 'object' || descriptor === null) {
            throw new TypeError('WebAssembly.Table(): Argument 0 must be a table descriptor');
        }

        let element = descriptor.element;

        if (!VALID_TABLE_ELEMENTS.includes(element)) {
            throw new TypeError(`WebAssembly.Table(): Invalid element type '${element}'`);
        }

        // 'anyfunc' is the legacy name for 'funcref'
        if (element === 'anyfunc') {
            element = 'funcref';
        }

        const initial = descriptor.initial;

        if (initial === undefined) {
            throw new TypeError('WebAssembly.Table(): Property \'initial\' is required');
        }

        if (typeof initial !== 'number' || initial < 0 || initial !== (initial >>> 0)) {
            throw new TypeError('WebAssembly.Table(): Property \'initial\' must be a non-negative integer');
        }

        const maximum = descriptor.maximum;

        if (maximum !== undefined) {
            if (typeof maximum !== 'number' || maximum < 0 || maximum !== (maximum >>> 0)) {
                throw new TypeError('WebAssembly.Table(): Property \'maximum\' must be a non-negative integer');
            }

            if (maximum < initial) {
                throw new RangeError('WebAssembly.Table(): Property \'maximum\' must be >= \'initial\'');
            }
        }

        this.#element = element;
    }

    static {
        bindTable = (t, instance, name) => {
            t.#instance = instance;
            t.#name = name;
        };
    }

    get length() {
        if (this.#instance) {
            return wasm.tableSize(this.#instance, this.#name);
        }

        return 0;
    }

    get(index) {
        if (!this.#instance) {
            throw new RangeError('WebAssembly.Table.get(): Table is not backed by an instance');
        }

        const raw = wasm.tableGet(this.#instance, this.#name, index);

        if (this.#element === 'funcref') {
            if (raw === null) {
                return null;
            }

            // raw is a function index; create a callable wrapper
            const instance = this.#instance;
            const funcIdx = raw;
            const fn = (...args) => callWasmFuncByIndex(instance, funcIdx, ...args);

            funcIndexMap.set(fn, funcIdx);

            return fn;
        }

        // externref: raw is already the JS value or null
        return raw;
    }

    set(index, value) {
        if (!this.#instance) {
            throw new RangeError('WebAssembly.Table.set(): Table is not backed by an instance');
        }

        if (this.#element === 'funcref') {
            if (value === null) {
                wasm.tableSet(this.#instance, this.#name, index, null);
            } else if (typeof value === 'function' && funcIndexMap.has(value)) {
                wasm.tableSet(this.#instance, this.#name, index, funcIndexMap.get(value));
            } else {
                throw new TypeError('WebAssembly.Table.set(): Argument 1 must be null or a WebAssembly function');
            }
        } else {
            wasm.tableSet(this.#instance, this.#name, index, value);
        }
    }

    grow(delta) {
        if (typeof delta !== 'number' || delta < 0 || delta !== (delta >>> 0)) {
            throw new TypeError('WebAssembly.Table.grow(): Argument 0 must be a non-negative integer');
        }

        if (!this.#instance) {
            throw new RangeError('WebAssembly.Table.grow(): Table is not backed by an instance');
        }

        return wasm.tableGrow(this.#instance, this.#name, delta);
    }
}

class WebAssembly {
    Module = Module;
    Instance = Instance;
    Memory = Memory;
    Global = Global;
    Table = Table;
    CompileError = CompileError;
    LinkError = LinkError;
    RuntimeError = RuntimeError;

    validate(src) {
        return wasm.validate(src);
    }

    async compile(src) {
        return new Module(src);
    }

    async instantiate(src, importObject) {
        const module = await this.compile(src);
        const instance = new Instance(module, importObject);

        return { module, instance };
    }

    async compileStreaming(source) {
        const response = await source;

        if (!(response instanceof Response)) {
            throw new TypeError(
                'WebAssembly.compileStreaming requires a Response object or a promise resolving to one',
            );
        }

        if (!response.ok) {
            throw new TypeError(`WebAssembly.compileStreaming failed: HTTP status code ${response.status}`);
        }

        const contentType = response.headers.get('content-type');

        if (contentType && !contentType.includes('application/wasm')) {
            throw new TypeError(
                `WebAssembly.compileStreaming requires content type application/wasm, got ${contentType}`,
            );
        }

        const bytes = await response.arrayBuffer();

        return this.compile(bytes);
    }

    async instantiateStreaming(source, importObject) {
        const module = await this.compileStreaming(source);
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
