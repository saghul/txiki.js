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
const kWasmTableInstance = Symbol('kWasmTableInstance');
const kWasmTableName = Symbol('kWasmTableName');
const kWasmTableElement = Symbol('kWasmTableElement');
const kWasmFuncIndex = Symbol('kWasmFuncIndex');


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
    constructor(buf) {
        this[kWasmModule] = parseModule(buf);
    }

    static exports(module) {
        return wasm.moduleExports(module[kWasmModule]);
    }

    static imports(module) {
        return wasm.moduleImports(module[kWasmModule]);
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
    constructor(module, importObject = {}) {
        // Detect WASI in importObject via duck typing and configure it before instantiation
        for (const ns of Object.values(importObject)) {
            if (ns && typeof ns === 'object' && typeof ns._configure === 'function') {
                ns._configure(module[kWasmModule]);
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

            // Skip WASI-like modules
            if (typeof ns._configure === 'function') {
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
                wasm.resolveImports(module[kWasmModule], funcDescs);
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
                wasm.resolveGlobalImports(module[kWasmModule], globalDescs);
            } catch (e) {
                if (e.wasmError) {
                    throw getWasmError(e);
                } else {
                    throw e;
                }
            }
        }

        const instance = buildInstance(module[kWasmModule]);

        // Wire up imported Memory objects to the WAMR instance
        for (const mem of memoryImports) {
            mem[kWasmMemoryInstance] = instance;
            mem[kWasmMemoryBuffer] = null;
        }

        const _exports = Module.exports(module);
        const exports = Object.create(null);

        for (const item of _exports) {
            if (item.kind === 'function') {
                const fn = callWasmFunction.bind(instance, item.name);
                const funcIdx = wasm.getFuncIndex(instance, item.name);

                if (funcIdx >= 0) {
                    fn[kWasmFuncIndex] = funcIdx;
                }

                exports[item.name] = fn;
            } else if (item.kind === 'memory') {
                const mem = new Memory({ initial: 0 });

                mem[kWasmMemoryInstance] = instance;
                mem[kWasmMemoryBuffer] = null;
                exports[item.name] = mem;
            } else if (item.kind === 'global') {
                const info = wasm.getGlobalInfo(instance, item.name);
                const gType = VALID_GLOBAL_TYPES.includes(info.type) ? info.type : 'i32';
                const g = new Global({ value: gType, mutable: info.mutable }, 0);

                g[kWasmGlobalInstance] = instance;
                g[kWasmGlobalName] = item.name;
                g[kWasmGlobalType] = info.type;
                g[kWasmGlobalMutable] = info.mutable;
                g[kWasmGlobalValue] = undefined;
                exports[item.name] = g;
            } else if (item.kind === 'table') {
                const info = wasm.getTableInfo(instance, item.name);
                const tbl = new Table({ element: info.element, initial: 0 });

                tbl[kWasmTableInstance] = instance;
                tbl[kWasmTableName] = item.name;
                tbl[kWasmTableElement] = info.element;
                exports[item.name] = tbl;
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

        this[kWasmGlobalInstance] = null;
        this[kWasmGlobalName] = null;
        this[kWasmGlobalType] = type;
        this[kWasmGlobalMutable] = mutable;
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

        this[kWasmGlobalValue] = coerceGlobalValue(type, initialValue);
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

const VALID_TABLE_ELEMENTS = [ 'anyfunc', 'funcref', 'externref' ];

class Table {
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

        this[kWasmTableInstance] = null;
        this[kWasmTableName] = null;
        this[kWasmTableElement] = element;
    }

    get length() {
        if (this[kWasmTableInstance]) {
            return wasm.tableSize(this[kWasmTableInstance], this[kWasmTableName]);
        }

        return 0;
    }

    get(index) {
        if (!this[kWasmTableInstance]) {
            throw new RangeError('WebAssembly.Table.get(): Table is not backed by an instance');
        }

        const raw = wasm.tableGet(this[kWasmTableInstance], this[kWasmTableName], index);

        if (this[kWasmTableElement] === 'funcref') {
            if (raw === null) {
                return null;
            }

            // raw is a function index; create a callable wrapper
            const instance = this[kWasmTableInstance];
            const funcIdx = raw;
            const fn = (...args) => callWasmFuncByIndex(instance, funcIdx, ...args);

            fn[kWasmFuncIndex] = funcIdx;

            return fn;
        }

        // externref: raw is already the JS value or null
        return raw;
    }

    set(index, value) {
        if (!this[kWasmTableInstance]) {
            throw new RangeError('WebAssembly.Table.set(): Table is not backed by an instance');
        }

        if (this[kWasmTableElement] === 'funcref') {
            if (value === null) {
                wasm.tableSet(this[kWasmTableInstance], this[kWasmTableName], index, null);
            } else if (typeof value === 'function' && kWasmFuncIndex in value) {
                wasm.tableSet(this[kWasmTableInstance], this[kWasmTableName], index, value[kWasmFuncIndex]);
            } else {
                throw new TypeError('WebAssembly.Table.set(): Argument 1 must be null or a WebAssembly function');
            }
        } else {
            wasm.tableSet(this[kWasmTableInstance], this[kWasmTableName], index, value);
        }
    }

    grow(delta) {
        if (typeof delta !== 'number' || delta < 0 || delta !== (delta >>> 0)) {
            throw new TypeError('WebAssembly.Table.grow(): Argument 0 must be a non-negative integer');
        }

        if (!this[kWasmTableInstance]) {
            throw new RangeError('WebAssembly.Table.grow(): Table is not backed by an instance');
        }

        return wasm.tableGrow(this[kWasmTableInstance], this[kWasmTableName], delta);
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
}


Object.defineProperty(globalThis, 'WebAssembly', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new WebAssembly()
});
