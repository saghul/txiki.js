import core from 'tjs:internal/core';
const ffiInt = core.ffi_load_native();

import buildAstToSymbols, { parseCProto } from './ffiutils.js';
import buildDefineStruct from './structs.js';

const suffixMap = { macOS: 'dylib', Windows: 'dll' };

export const suffix = suffixMap[navigator.userAgentData.platform] ?? 'so';

// The platform's C and math libraries, i.e. how a dlopen() call names them
// portably.
export const LIBC_NAME = ffiInt.LIBC_NAME;
export const LIBM_NAME = ffiInt.LIBM_NAME;


// Pins the owning UvLib on the native symbol: a UvDlSym holds nothing but a raw
// function pointer, so without this the library could be collected and
// dlclose()d while a symbol resolved from it is still callable. The pin lives on
// the native object rather than on DlSymbol so that holding just the native
// symbol (as dlopen's fast path does) keeps the library loaded.
const kLib = Symbol('uvlib');

// Module-private accessor for DlSymbol's native symbol, which CFunction and
// dlopen hand to FfiCif. Installed from the class body so the native symbol
// stays unreachable outside this module.
let nativeSymbol;

class DlSymbol {
    #dlsym;

    static {
        nativeSymbol = sym => sym.#dlsym;
    }

    constructor(uvlib, dlsym) {
        dlsym[kLib] = uvlib;
        this.#dlsym = dlsym;
    }
    get addr() {
        return this.#dlsym.addr;
    }
}

class Lib {
    #uvlib;

    constructor(libname) {
        this.#uvlib = new ffiInt.UvLib(libname);
    }
    symbol(name) {
        return new DlSymbol(this.#uvlib, this.#uvlib.symbol(name));
    }

    close() {
        this.#uvlib.close();
    }

    [Symbol.dispose]() {
        this.close();
    }
}

export class AdvancedType {
    #ffiType;
    #conf;

    constructor(type, conf) {
        this.#ffiType = type;
        this.#conf = conf;
    }
    toBuffer(data, ctx = {}) {
        if (this.#conf.toBuffer) {
            return this.#conf.toBuffer(data, ctx);
        } else {
            return this.#ffiType.toBuffer(data, ctx);
        }
    }
    fromBuffer(buf, ctx = {}) {
        if (this.#conf.fromBuffer) {
            return this.#conf.fromBuffer(buf, ctx);
        } else {
            return this.#ffiType.fromBuffer(buf, ctx);
        }
    }
    get ffiType() {
        return this.#ffiType;
    }
    get ffiTypeStruct() {
        return this.#conf.getFfiTypeStruct ? this.#conf.getFfiTypeStruct() : this.#ffiType;
    }
    get name() {
        return this.#conf.name;
    }
    get size() {
        return this.#ffiType.size;
    }
}

class CFunction {
    // Holding the DlSymbol keeps the library it came from loaded (see kLib).
    #symbol;
    #rtype;
    #argtypes;
    #cif;

    constructor(symbol, rtype, argtypes, fixed) {
        this.#symbol = symbol;
        this.#rtype = rtype;
        this.#argtypes = argtypes;

        function getFfiType(t) {
            if (t.ffiType) {
                return t.ffiType;
            }

            return t;
        }

        this.#cif = new ffiInt.FfiCif(getFfiType(rtype), ...argtypes.map(getFfiType), fixed);
    }
    call(...argsJs) {
        const ctx = {};
        const args = [];

        for (const i in argsJs) {
            ctx[i] = {};
            args[i] = this.#argtypes[i].toBuffer(argsJs[i], ctx[i]);
        }

        const ret = this.#cif.call(nativeSymbol(this.#symbol), ...args);

        ctx['ret'] = {};

        return this.#rtype.fromBuffer(ret, ctx['ret']);
    }
}

// A single shared instance: dlopen()'s fast-path check compares argument types
// by identity, so minting a fresh AdvancedType per types.jscallback() call would
// make every callback signature fall back to the slow path.
const jscallbackType = new AdvancedType(ffiInt.type_pointer, {
    toBuffer: jsc => {
        if (!(jsc instanceof JSCallback)) {
            throw new Error('not a JSCallback');
        }

        return jsc.addr;
    },
    fromBuffer: () =>{
        throw new Error('JSCallback as a return is not supported!');
    },
    name: 'jscallback'
});

export const types = {
    void: ffiInt.type_void,
    uint8: ffiInt.type_uint8,
    sint8: ffiInt.type_sint8,
    uint16: ffiInt.type_uint16,
    sint16: ffiInt.type_sint16,
    uint32: ffiInt.type_uint32,
    sint32: ffiInt.type_sint32,
    uint64: ffiInt.type_uint64,
    sint64: ffiInt.type_sint64,
    float: ffiInt.type_float,
    double: ffiInt.type_double,
    pointer: ffiInt.type_pointer,
    longdouble: ffiInt.type_longdouble,
    uchar: ffiInt.type_uchar,
    schar: ffiInt.type_schar,
    ushort: ffiInt.type_ushort,
    sshort: ffiInt.type_sshort,
    uint: ffiInt.type_uint,
    sint: ffiInt.type_sint,
    ulong: ffiInt.type_ulong,
    slong: ffiInt.type_slong,
    ullong: ffiInt.type_ull,
    sllong: ffiInt.type_sll,

    size: ffiInt.type_size,
    ssize: ffiInt.type_ssize,

    string: new AdvancedType(ffiInt.type_pointer, {
        toBuffer: (str, ctx)=>{
            ctx.buf = (new TextEncoder()).encode(str+'\0');

            // cstrings are pointers char*, the pointer itself is the argument, and since ffi expects pointers
            // to the argument data, so we effectively need a char**.
            // If we return the ptr to the buffer, the C code will handle the allocation for us.
            return ffiInt.getArrayBufPtr(ctx.buf);
        },
        fromBuffer: buf=>{
            const ptr = ffiInt.type_pointer.fromBuffer(buf); // char*
            const str = ffiInt.getCString(ptr); // string

            return str;
        },
        name: 'string'
    }),

    buffer: new AdvancedType(ffiInt.type_pointer, {
        toBuffer: buf => ffiInt.getArrayBufPtr(buf),
        fromBuffer: () =>{
            throw new Error('type buffer cannot be used as a return type, since the size is not known!');
        },
        name: 'buffer'
    }),

    // A JS boolean carried by an unsigned integer, in the two widths C code uses
    // for a flag: C99 `bool` (and ObjC `BOOL`) is one byte, Win32 `BOOL` is four.
    bool_u8: new AdvancedType(ffiInt.type_uint8, {
        toBuffer: b => ffiInt.type_uint8.toBuffer(b ? 1 : 0),
        fromBuffer: buf => Boolean(ffiInt.type_uint8.fromBuffer(buf)),
        name: 'bool_u8'
    }),

    bool_u32: new AdvancedType(ffiInt.type_uint32, {
        toBuffer: b => ffiInt.type_uint32.toBuffer(b ? 1 : 0),
        fromBuffer: buf => Boolean(ffiInt.type_uint32.fromBuffer(buf)),
        name: 'bool_u32'
    }),

    jscallback: () => jscallbackType
};

const typeMap = [
    [ types.void, [ 'void' ] ],
    [ types.uint8, [ 'uint8_t' ] ],
    [ types.uint16, [ 'uint16_t' ] ],
    [ types.uint32, [ 'uint32_t' ] ],
    [ types.uint64, [ 'uint64_t' ] ],
    [ types.sint8, [ 'int8_t' ] ],
    [ types.sint16, [ 'int16_t' ] ],
    [ types.sint32, [ 'int32_t' ] ],
    [ types.sint64, [ 'int64_t' ] ],
    [ types.float, [ 'float' ] ],
    [ types.double, [ 'double' ] ],
    [ types.pointer, [ 'void*' ] ],
    [ types.longdouble, [ 'long double' ] ],
    [ types.uchar, [ 'unsigned char' ] ],
    [ types.schar, [ 'signed char', 'char' ] ],
    [ types.ushort, [ 'unsigned short', 'unsigned short int' ] ],
    [ types.sshort, [ 'signed short', 'signed short int', 'short int' ] ],
    [ types.uint, [ 'unsigned int', 'unsigned' ] ],
    [ types.sint, [ 'signed int', 'int' ] ],
    [ types.ulong, [ 'unsigned long', 'unsigned long int' ] ],
    [ types.slong, [ 'signed long', 'signed long int', 'long', 'long int' ] ],
    [ types.ullong, [ 'unsigned long long', 'unsigned long long int' ] ],
    [ types.sllong, [ 'signed long long', 'signed long long int', 'long long', 'long long int' ] ],

    [ types.size, [ 'size_t' ] ],
    [ types.ssize, [ 'ssize_t' ] ],
    [ types.string, [ 'char*' ] ],

];

export function bufferToString(buf) {
    return ffiInt.getCString(ffiInt.getArrayBufPtr(buf), buf.length);
}

export function stringToBuffer(s) {
    return ffiInt.toCString(s);
}

export function bufferToPointer(buf) {
    return ffiInt.getArrayBufPtr(buf);
}

// Rebuild a NativePointer from a raw address obtained via `pointer.value`
// (a BigInt). Primarily for moving a pointer across a same-process worker
// thread: postMessage `pointer.value`, then `createPointer(addr)` on the
// other side. See NativePointer.value for the caveats.
export function createPointer(addr) {
    return ffiInt.createPointer(addr);
}

// The zero-copy ArrayBuffer subtype returned by NativePointer.toArrayBuffer()
// (and backing the Uint8Array from NativePointer.toUint8Array()). It is a real
// ArrayBuffer with an extra detach() method; see src/mod_ffi.c.
export const ExternalArrayBuffer = ffiInt.ExternalArrayBuffer;

// Module-private setter for the library pin on a Pointer to a data symbol, used
// by dlopen. Installed from the class body so a Pointer built by a caller keeps
// exposing nothing but its address, level and type.
let pinPointerLib;

export class Pointer {
    #type;
    #level;
    #addr;
    // Set by createRefFromBuf() to keep the pointed-to buffer from being GCed;
    // never read.
    #data;
    // Set by pinPointerLib() for the same reason, for the library a data symbol
    // was resolved from; never read.
    #lib;

    static {
        pinPointerLib = (ptr, lib) => {
            ptr.#lib = lib;
        };
    }

    constructor(addr, level, type) {
        this.#type = type;
        this.#level = level;
        this.#addr = addr;
    }
    get addr() {
        return this.#addr;
    }
    get level() {
        return this.#level;
    }
    get type() {
        return this.#type;
    }
    get isNull() {
        return this.#addr === null;
    }
    deref() {
        if (this.level === 1) {
            const addr = this.#addr;
            const buf = ffiInt.ptrToBuffer(addr, this.#type.size);

            return this.#type.fromBuffer(buf, {});
        } else {
            const addr = ffiInt.derefPtr(this.#addr, 1);

            return new Pointer(addr, this.#level - 1, this.#type);
        }
    }
    derefAll() {
        const addr = ffiInt.derefPtr(this.#addr, this.#level-1);
        const buf = ffiInt.ptrToBuffer(addr, this.#type.size);

        return this.#type.fromBuffer(buf, {});
    }
    static createRef(type, data) {
        const buf = type.toBuffer(data, {});

        return Pointer.createRefFromBuf(type, buf);
    }
    static createRefFromBuf(type, buf) {
        const addr = ffiInt.getArrayBufPtr(buf);
        const ptr = new Pointer(addr, 1, type);

        ptr.#data = buf;

        return ptr;
    }
}

export class PointerType extends AdvancedType {
    #level;
    #type;

    constructor(type, level = 1) {
        super(types.pointer || type, {
            name: (type.name || 'void') + ('*').repeat(level),
        });
        this.#level = level;
        this.#type = type;
    }
    toBuffer(data, ctx = {}) {
        if (data instanceof Pointer) {
            return types.pointer.toBuffer(data.addr, ctx);
        }

        // Only a native pointer (NativePointer) or null can be marshalled as a
        // raw pointer. Anything else — most commonly a plain object a caller
        // expects to be passed by reference — would otherwise be coerced to a
        // NULL pointer silently (a likely crash in C). Fail loudly and point at
        // the supported idiom instead.
        if (data === null || ffiInt.isPointer(data)) {
            return types.pointer.toBuffer(data, ctx);
        }

        throw new TypeError(
            'PointerType expects a Pointer, a native pointer, or null; ' +
            'to pass a value by reference use Pointer.createRef(type, value)');
    }
    fromBuffer(buf, ctx = {}) {
        return new Pointer(types.pointer.fromBuffer(buf, ctx), this.#level, this.#type);
    }
    get type() {
        return this.#type;
    }
    get level() {
        return this.#level;
    }
}

export class StructType extends AdvancedType {
    #fields;

    constructor(fields, name) {
        const ffitype = new ffiInt.FfiType(...fields.map(([ _f, t ]) => t.ffiTypeStruct || t.ffiType || t));

        super(ffitype, {
            toBuffer: (obj, ctx)=>{
                const buf = new Uint8Array(this.ffiType.size);
                const offsets = this.ffiType.offsets;

                for (let i=0; i<offsets.length; i++) {
                    const [ field, type ] = this.#fields[i];

                    // eslint-disable-next-line no-prototype-builtins
                    if (obj.hasOwnProperty(field)) {
                        let sbuf = type.toBuffer(obj[field], ctx);

                        buf.set(sbuf, offsets[i]);
                    }
                }

                return buf;
            },
            fromBuffer: (buf, ctx)=>{
                let obj = {};
                const offsets = this.ffiType.offsets;

                for (let i=0; i<offsets.length; i++) {
                    const [ field, type ] = this.#fields[i];
                    const fbuf = buf.slice(offsets[i], offsets[i] + type.size);

                    obj[field] = type.fromBuffer(fbuf, ctx);
                }

                return obj;
            },
            name
        });
        this.#fields = fields;
    }
    get fields() {
        return this.#fields;
    }
}

export class ArrayType extends AdvancedType {
    #length;
    #ffiStruct;

    constructor(type, length, name) {
        const ffitype = type.ffiType ? type.ffiType : type;
        const ffisz = ffitype.size;

        super(ffitype, {
            toBuffer: (arr, ctx)=>{
                if (arr.length > this.#length) {
                    throw new RangeError('Array length exceeds type length');
                }

                const buf = new Uint8Array(ffisz*length);

                for (let i=0; i<arr.length; i++) {
                    let sbuf = type.toBuffer(arr[i], ctx);

                    buf.set(sbuf, i*ffisz);
                }

                return buf;
            },
            fromBuffer: (buf, ctx)=>{
                let arr = [];

                for (let i=0; i<this.#length; i++) {
                    arr[i] = type.fromBuffer(buf.slice(i*ffisz, (i+1)*ffisz), ctx);
                }

                return arr;
            },
            name,
        });
        this.#length = length;
    }
    get ffiTypeStruct() {
        if (!this.#ffiStruct) {
            this.#ffiStruct = new ffiInt.FfiType(this.#length, this.ffiType);
        }

        return this.#ffiStruct;
    }
    get length() {
        return this.#length;
    }
    get size() {
        return this.ffiType.size * this.#length;
    }
}

export class StaticStringType extends ArrayType {
    constructor(length, name) {
        super(types.sint8, length, name);
    }
    toBuffer(str, ctx = {}) {
        const txtBuf = (new TextEncoder()).encode(str);

        return super.toBuffer(txtBuf, ctx);
    }
    fromBuffer(buf) {
        return ffiInt.getCString(ffiInt.getArrayBufPtr(buf), buf.length);
    }
}

export const read = ffiInt.read;

export function errno() {
    return ffiInt.errno();
}

export function strerror(err = errno()) {
    return ffiInt.strerror(err);
}


export class JSCallback {
    // The closure calls through the cif and the wrapper, so both have to outlive
    // it; keep them alive here.
    #func;
    #cif;
    #closure;
    #addr;

    constructor(rtype, argtypes, func) {
        this.#func = (...args) => {
            const arr = [];
            const ctx = {};

            for (let i=0;i<argtypes.length;i++) {
                ctx[i] = {};
                arr.push(argtypes[i].fromBuffer(args[i], ctx[i]));
            }

            const ret = func(...arr);

            return rtype.toBuffer(ret);
        };

        this.#cif = new ffiInt.FfiCif(rtype.ffiType ?? rtype, ...argtypes.map(t => t.ffiType ?? t));
        this.#closure = new ffiInt.FfiClosure(this.#cif, this.#func);

        // The closure's code pointer is fixed at creation and lives as long as the
        // closure does, so the NativePointer wrapping it is minted once: reading
        // .addr happens on every call that passes this callback.
        this.#addr = this.#closure.addr;
    }
    get addr() {
        return this.#addr;
    }
}

const astToSymbols = buildAstToSymbols({ StructType, ArrayType, PointerType, types, typeMap });

const typeAliases = {
    void: types.void,
    u8: types.uint8, uint8: types.uint8, uint8_t: types.uint8,
    i8: types.sint8, sint8: types.sint8, int8_t: types.sint8,
    u16: types.uint16, uint16: types.uint16, uint16_t: types.uint16,
    i16: types.sint16, sint16: types.sint16, int16_t: types.sint16,
    u32: types.uint32, uint32: types.uint32, uint32_t: types.uint32,
    i32: types.sint32, sint32: types.sint32, int32_t: types.sint32, int: types.sint32,
    u64: types.uint64, uint64: types.uint64, uint64_t: types.uint64,
    i64: types.sint64, sint64: types.sint64, int64_t: types.sint64,
    f32: types.float, float: types.float,
    f64: types.double, double: types.double,
    pointer: types.pointer, ptr: types.pointer,
    string: types.string, cstring: types.string,
    buffer: types.buffer,
    bool_u8: types.bool_u8, bool_u32: types.bool_u32,
    uchar: types.uchar, schar: types.schar, char: types.schar,
    ushort: types.ushort, sshort: types.sshort,
    uint: types.uint, sint: types.sint,
    ulong: types.ulong, slong: types.slong, long: types.slong,
    size_t: types.size, ssize_t: types.ssize,
};

function resolveType(t) {
    if (typeof t === 'string') {
        const resolved = typeAliases[t];

        if (!resolved) {
            throw new TypeError(`Unknown FFI type: '${t}'`);
        }

        return resolved;
    }

    return t;
}

// Declaring a struct layout is a job of its own, so it lives in structs.js; the
// pieces it needs (the type vocabulary, the libffi-facing StructType, the
// pointer helpers) are handed to it rather than exported, which would widen this
// module's public surface.
export const { defineStruct, defineEnum, allocStruct } = buildDefineStruct({
    AdvancedType,
    ArrayType,
    StructType,
    types,
    resolveType,
    createPointer,
    bufferToPointer,
    isPointer: ffiInt.isPointer,
});

// `using lib = dlopen(...)` has to work, but what the dlopen() family hands back
// is a plain object rather than one of the stdlib's disposable classes, so alias
// its close() as Symbol.dispose here. Non-enumerable, like the method a class
// would carry on its prototype.
function withDispose(handle) {
    return Object.defineProperty(handle, Symbol.dispose, {
        value: handle.close,
        writable: true,
        enumerable: false,
        configurable: true,
    });
}

export function dlopen(path, symbols) {
    // Resolve all types before opening the library so that type errors
    // don't leave a library handle open.
    const resolved = {};

    for (const [ name, def ] of Object.entries(symbols)) {
        // The C symbol to resolve. It defaults to the map key, which is only the
        // JS property name: an explicit `name` lets one C symbol be bound more
        // than once (different signatures of a variadic function, say) and lets a
        // C name be exposed under a friendlier one.
        const symbol = def.name ?? name;

        if (def.type !== undefined) {
            if (def.returns !== undefined || def.args !== undefined) {
                throw new TypeError(
                    `FFI symbol '${name}': 'type' declares a data symbol, ` +
                    'it cannot be combined with \'returns\' or \'args\'');
            }

            resolved[name] = { symbol, optional: def.optional, type: resolveType(def.type) };

            continue;
        }

        resolved[name] = {
            symbol,
            optional: def.optional,
            returns: resolveType(def.returns ?? 'void'),
            args: (def.args ?? []).map(resolveType),
            fixed: def.fixed,
        };
    }

    const lib = new Lib(path);
    const result = {};

    try {
        bindSymbols(lib, resolved, result);
    } catch (e) {
        // The library is open at this point and nothing else references it yet
        // (a failure here means the caller gets no symbols), so close it instead
        // of leaving the handle open until the Lib is finalized. Unresolvable
        // symbol names make this the common path, not a corner case.
        lib.close();

        throw e;
    }

    return withDispose({
        symbols: result,
        close: () => lib.close(),
    });
}

// Same as dlopen(), but the symbol definitions come from C declarations instead
// of a JS object: every function the header declares is bound, and the types it
// declares (structs, typedefs, and the pointer types derived from them) come
// back keyed by the name they were declared under, e.g. 'struct test'.
export function dlopenCProto(path, header) {
    // Parse before opening the library so a malformed header doesn't leave a
    // handle open.
    const { symbols, types: declaredTypes } = astToSymbols(parseCProto(header));
    const { symbols: bound, close } = dlopen(path, symbols);

    return withDispose({ symbols: bound, types: declaredTypes, close });
}

function bindSymbols(lib, resolved, result) {
    for (const [ name, def ] of Object.entries(resolved)) {
        let sym;

        try {
            sym = lib.symbol(def.symbol);
        } catch (e) {
            if (!def.optional) {
                throw e;
            }

            // The symbol isn't there: leave the property out entirely, so that
            // `name in symbols` tells the caller whether this build of the
            // library has it. Only the resolution is guarded — anything that
            // goes wrong while binding a symbol that *does* exist still throws.
            continue;
        }

        if (def.type) {
            // A data symbol: the symbol's address *is* the global, so hand back a
            // level-1 Pointer at it rather than a callable. A deeper indirection
            // (an int* global, say) is `new Pointer(p.addr, 2, type)` built from
            // this one.
            const ptr = new Pointer(sym.addr, 1, def.type);

            // A Pointer holds nothing but a raw address, so pin the native symbol
            // on it (which pins the library, see kLib) — otherwise a GC could
            // dlclose() the library and unmap the global while the Pointer is
            // still reachable.
            pinPointerLib(ptr, nativeSymbol(sym));

            result[name] = ptr;

            continue;
        }

        // A PointerType return marshals as a plain pointer; the only thing its
        // fromBuffer adds is the Pointer wrapper, which the closure below
        // reproduces. Every other AdvancedType return (struct, array, static
        // string, buffer) needs its own fromBuffer and stays on the slow path.
        const returnsPointerType = def.returns instanceof PointerType;

        // Check if all arg types are simple (scalar/pointer/string/buffer/jscallback)
        // and if so, use the fast call path. jscallback is not allowed as a return
        // type — that has no meaning, and its fromBuffer throws.
        const canFastCall = def.args.length <= 16 && def.args.every(t =>
            t === types.string || t === types.buffer || t === jscallbackType || !t.ffiType
        ) && (def.returns === types.string || returnsPointerType || !def.returns.ffiType);

        if (canFastCall) {
            // Build bitmasks for string, buffer and jscallback arguments.
            let stringMask = 0;
            let bufferMask = 0;
            let callbackMask = 0;

            for (let i = 0; i < def.args.length; i++) {
                if (def.args[i] === types.string) {
                    stringMask |= (1 << i);
                } else if (def.args[i] === types.buffer) {
                    bufferMask |= (1 << i);
                } else if (def.args[i] === jscallbackType) {
                    callbackMask |= (1 << i);
                }
            }

            if (def.returns === types.string) {
                stringMask |= (1 << 31);
            }

            const ffiArgTypes = def.args.map(t => t.ffiType ?? t);
            const ffiRetType = def.returns.ffiType ?? def.returns;
            const cif = new ffiInt.FfiCif(ffiRetType, ...ffiArgTypes, def.fixed);
            // The captured native symbol keeps the library loaded (see kLib), so
            // the bound function stays valid even if the Lib is collected.
            const dlsym = nativeSymbol(sym);

            if (returnsPointerType) {
                // fast_call returns a bare NativePointer, or null for NULL. Both
                // are what PointerType.fromBuffer feeds to Pointer, so wrapping
                // them here yields the same value the slow path produced —
                // including a Pointer whose isNull is true for a NULL return.
                // Read level/type once: they are fixed for this symbol.
                const level = def.returns.level;
                const pointee = def.returns.type;

                result[name] = (...a) =>
                    new Pointer(cif.fast_call(dlsym, stringMask, bufferMask, callbackMask, ...a), level, pointee);
            } else {
                result[name] = (...a) => cif.fast_call(dlsym, stringMask, bufferMask, callbackMask, ...a);
            }
        } else {
            // Fallback to CFunction for complex types (structs, etc.)
            const func = new CFunction(sym, def.returns, def.args, def.fixed);

            result[name] = (...a) => func.call(...a);
        }
    }
}
