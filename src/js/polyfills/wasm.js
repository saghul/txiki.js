const core = globalThis[Symbol.for('tjs.internal.core')];
const wasm = core.wasm;

const kWasmModule = Symbol('kWasmModule');
const kWasmModuleRef = Symbol('kWasmModuleRef');
const kWasmExports = Symbol('kWasmExports');
const kWasmInstance = Symbol('kWasmInstance');


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

class WebAssembly {
    Module = Module;
    Instance = Instance;
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
