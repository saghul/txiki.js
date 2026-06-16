/**
 * Foreign Function Interface module.
 *
 * Call native C library functions directly from JavaScript. Supports loading
 * shared libraries, defining function signatures, and working with C types
 * including structs, pointers, and callbacks.
 *
 * ```js
 * import { Lib, CFunction, types } from 'tjs:ffi';
 *
 * const lib = new Lib(Lib.LIBC_NAME);
 * const getpid = new CFunction(lib.symbol('getpid'), types.sint, []);
 * console.log(`PID: ${getpid.call()}`);
 * ```
 *
 * @module tjs:ffi
 */
declare module 'tjs:ffi'{
    /**
     * Opaque pointer object. Stores a native `void*` with full precision.
     * Null pointers are represented as JavaScript `null`.
     */
    export interface NativePointer {
        /** Returns hex string representation, e.g. `"0x7fff5a2b3c00"`. */
        toString(): string;
        /** Returns a new pointer offset by `n` bytes. */
        offset(n: number): NativePointer;
        /** Returns `true` if both pointers refer to the same address. */
        equals(other: NativePointer | null): boolean;
        /**
         * Returns a **zero-copy** `Uint8Array` of `byteLength` bytes that aliases
         * the native memory starting at this pointer (plus an optional
         * `byteOffset`). No data is copied: reads and writes go straight to the
         * underlying memory. Its `.buffer` is an {@link ExternalArrayBuffer}, so
         * the view can be invalidated with `view.buffer.detach()`.
         *
         * The view does **not** keep the memory alive and the runtime never
         * frees it. The caller is responsible for ensuring the memory outlives
         * every view over it; accessing a view after the memory has been freed,
         * moved or reallocated is undefined behaviour and can crash the process.
         */
        toUint8Array(byteLength: number, byteOffset?: number): Uint8Array;
        /**
         * Like {@link NativePointer.toUint8Array}, but returns a zero-copy
         * {@link ExternalArrayBuffer}. The same lifetime caveats apply.
         */
        toArrayBuffer(byteLength: number, byteOffset?: number): ExternalArrayBuffer;
    }

    /**
     * A **zero-copy** `ArrayBuffer` that aliases native memory, returned by
     * {@link NativePointer.toArrayBuffer} (and backing the `Uint8Array` from
     * {@link NativePointer.toUint8Array}). It is a real `ArrayBuffer` — accepted
     * anywhere one is — with one extra method.
     */
    export interface ExternalArrayBuffer extends ArrayBuffer {
        /**
         * Detach the buffer, invalidating it and every view over it: afterwards
         * its `byteLength` is `0`, `detached` is `true`, and any `TypedArray`
         * backed by it reads as empty.
         *
         * Use this to make a view safe to keep after you free the native memory
         * it aliased — it turns a potential use-after-free into a harmless empty
         * buffer. Unlike `ArrayBuffer.prototype.transfer()`, it does **not** read
         * or copy the underlying bytes, so it is safe to call once the memory is
         * gone.
         */
        detach(): void;
    }

    /**
     * The {@link ExternalArrayBuffer} constructor, exposed for `instanceof`
     * checks. Not constructible — instances come from {@link NativePointer}
     * views.
     */
    export const ExternalArrayBuffer: Function & { readonly prototype: ExternalArrayBuffer };

    /**
     * Direct memory reads from a pointer at a given byte offset.
     * Faster than creating an intermediate buffer for one-off reads.
     *
     * Note: `u64`/`i64` return a JavaScript `number`, which cannot represent
     * every 64-bit value. Magnitudes above `Number.MAX_SAFE_INTEGER` (2**53 - 1)
     * lose precision, and `u64` values with the high bit set read back as a
     * negative number (the bytes are interpreted as a signed `int64`). Use the
     * low 53 bits only, or read the raw bytes via `toUint8Array` if you need the
     * exact value.
     */
    export const read: {
        u8(ptr: NativePointer, offset?: number): number;
        i8(ptr: NativePointer, offset?: number): number;
        u16(ptr: NativePointer, offset?: number): number;
        i16(ptr: NativePointer, offset?: number): number;
        u32(ptr: NativePointer, offset?: number): number;
        i32(ptr: NativePointer, offset?: number): number;
        /** Lossy above 2**53 - 1; high-bit-set values read back negative. */
        u64(ptr: NativePointer, offset?: number): number;
        /** Lossy above 2**53 - 1. */
        i64(ptr: NativePointer, offset?: number): number;
        f32(ptr: NativePointer, offset?: number): number;
        f64(ptr: NativePointer, offset?: number): number;
        ptr(ptr: NativePointer, offset?: number): NativePointer | null;
    };

    export class DlSymbol{
        /** Instances come only from {@link Lib.symbol}; not user-constructible. */
        private constructor();
        readonly addr: NativePointer;
    }

    export interface SimpleType<T = any>{
        toBuffer(data: T, ctx?: {}): Uint8Array;
        fromBuffer(buffer: Uint8Array, ctx?: {}): T;
        readonly size: number;
        readonly name: string;
    }

    export class AdvancedType<T, ST extends SimpleType<T>> implements SimpleType<T>{
        constructor(type: ST, conf: {
            toBuffer?: (data: T, ctx?: {}) => Uint8Array,
            fromBuffer?: (buf: Uint8Array, ctx?: {}) => T,
            getFfiTypeStruct?: () => SimpleType<T>,
            name?: string
        });
        readonly ffiType: ST;
        readonly ffiTypeStruct: SimpleType<T>
        
        toBuffer(data: T, ctx?: {}): Uint8Array;
        fromBuffer(buffer: Uint8Array, ctx?: {}): T;
        readonly size: number;
        readonly name: string;
    }

    export class Lib{
        constructor(libname: string);
        symbol(name: string): DlSymbol;
        /**
         * Explicitly close the shared library handle. After calling this,
         * any symbols obtained from this library must not be used.
         *
         * Aliased as `Symbol.dispose`, so `using lib = new Lib(...)` closes
         * the handle at scope exit.
         */
        close(): void;
        static LIBC_NAME: string;
        static LIBM_NAME: string;

        registerType(name: string, type: SimpleType): void;
        getType(name: string): undefined|SimpleType;
        registerFunction(name: string, func: CFunction): void;
        getFunc(name: string): CFunction;
        call(funcname: string, ...args: any[]): any;
        parseCProto(header: string): void;
    }
    export interface Lib extends Disposable {}

    export class CFunction<JRT = unknown, JAT extends unknown[] = unknown[]>{
        constructor(symbol: DlSymbol, rtype: SimpleType<JRT>, argtypes: { [key in keyof JAT]: SimpleType<JAT[key]> }, fixed?: number);
        call(...argsJs: JAT): JRT;
    }

    export const types: {
        void: SimpleType<void>,
        uint8: SimpleType<number>,
        sint8: SimpleType<number>,
        uint16: SimpleType<number>,
        sint16: SimpleType<number>,
        uint32: SimpleType<number>,
        sint32: SimpleType<number>,
        uint64: SimpleType<number>,
        sint64: SimpleType<number>,
        float: SimpleType<number>,
        double: SimpleType<number>,
        pointer: SimpleType<NativePointer>,
        longdouble: SimpleType<number>, 
        uchar: SimpleType<number>,
        schar: SimpleType<number>,
        ushort: SimpleType<number>,
        sshort: SimpleType<number>,
        uint: SimpleType<number>,
        sint: SimpleType<number>,
        ulong: SimpleType<number>,
        slong: SimpleType<number>,
        sllong: SimpleType<number>,
        ullong: SimpleType<number>,

        size: SimpleType<number>,
        ssize: SimpleType<number>,

        string: SimpleType<string>,
        
        buffer: SimpleType<Uint8Array>,
        
        jscallback: <T extends JSCallback>() => SimpleType<T>,
    }

    /**
     * Platform-specific shared library file extension: `'dylib'` on macOS,
     * `'so'` on Linux, `'dll'` on Windows.
     */
    export const suffix: string;

    export function bufferToString(buf: Uint8Array): string;
    export function stringToBuffer(s: string): Uint8Array;
    export function bufferToPointer(buf: Uint8Array): NativePointer;

    export class Pointer<T, N extends number>{
        constructor(addr: NativePointer, level: N, type: SimpleType<T>);
        readonly addr: NativePointer;
        readonly level: N;
        readonly type: SimpleType<T>;
        readonly isNull: boolean;

        deref(): N extends 1 ? T : Pointer<T, any>;

        derefAll(): T;

        static createRef<T>(type: SimpleType<T>, data: T): Pointer<T, 1>;
        static createRefFromBuf<T>(type: SimpleType<T>, buf: Uint8Array): Pointer<T, 1>;
    }

    export class PointerType<T, ST extends SimpleType<T>, N extends number> extends AdvancedType<Pointer<T, N>, PointerType<T, ST, N>>{
        constructor(type: ST , level: N);
        toBuffer(data: Pointer<T, N>|NativePointer, ctx?: {}): Uint8Array;
        fromBuffer(buf: Uint8Array, ctx?: {}): Pointer<T, N>;
        get type(): ST;
        get level(): N;
    }

    export class StructType<Obj, FT extends Array<({
        [K in keyof Obj]: [K, SimpleType<Obj[K]>]
    })[keyof Obj]>> extends AdvancedType<Obj, StructType<Obj, FT>>{
        constructor(fields: FT, name: string);
        readonly fields: FT;
    }

    export class ArrayType<T> extends AdvancedType<Array<T>, ArrayType<T>>{
        constructor(type: SimpleType<T>, length: number, name: string);
        readonly ffiTypeStruct: SimpleType<Array<T>>;
        readonly length: number
        readonly size: number;
    }

    export class StaticStringType extends ArrayType<number>{
        constructor(length: number, name: string);
        toBuffer(str: string, ctx?: {}): Uint8Array;
        fromBuffer(buf: Uint8Array, ctx?: {}): string;
    }

    export function errno(): number;
    export function strerror(err?: number): string;
    export class JSCallback<RT = unknown, AT extends unknown[] = unknown[]>{
        constructor(rtype: SimpleType<RT>, argtypes: { [key in keyof AT]: SimpleType<AT[key]> }, func: (...args: AT) => RT);
        readonly addr: NativePointer;
    }

    /** Type conversion map (FFI type alias -> JS type) */
    export type TypeAliasMap = {
        readonly 'void': void;
        readonly 'u8': number;
        readonly 'uint8': number;
        readonly 'uint8_t': number;
        readonly 'i8': number;
        readonly 'sint8': number;
        readonly 'int8_t': number;
        readonly 'u16': number;
        readonly 'uint16': number;
        readonly 'uint16_t': number;
        readonly 'i16': number;
        readonly 'sint16': number;
        readonly 'int16_t': number;
        readonly 'u32': number;
        readonly 'uint32': number;
        readonly 'uint32_t': number;
        readonly 'int': number;
        readonly 'i32': number;
        readonly 'sint32': number;
        readonly 'int32_t': number;
        readonly 'u64': number;
        readonly 'uint64': number;
        readonly 'uint64_t': number;
        readonly 'i64': number;
        readonly 'sint64': number;
        readonly 'int64_t': number;
        readonly 'f32': number;
        readonly 'float': number;
        readonly 'f64': number;
        readonly 'double': number;
        readonly 'pointer': NativePointer | null;
        readonly 'ptr': NativePointer | null;
        readonly 'string': string;
        readonly 'cstring': string;
        readonly 'buffer': Uint8Array;
        readonly 'uchar': string;
        readonly 'schar': string;
        readonly 'char': string;
        readonly 'ushort': number;
        readonly 'sshort': number;
        readonly 'uint': number;
        readonly 'sint': number;
        readonly 'ulong': number;
        readonly 'slong': number;
        readonly 'long': number;
        readonly 'size_t': number;
        readonly 'ssize_t': number;
    };

    /**
     * String aliases for FFI types. Can be used in {@link dlopen} symbol definitions
     * instead of type objects from {@link types}.
     *
     * Supports short (`i32`, `u8`, `f64`, `ptr`), C-style (`int`, `char`, `double`),
     * and stdint-style (`uint32_t`, `int64_t`) names.
     */
    export type TypeAlias = keyof TypeAliasMap;
    export type TypeOrAlias = SimpleType | TypeAlias;

    /**
     * Describes a native function symbol for use with {@link dlopen}.
     */
    export interface DlopenSymbol {
        /** Argument types. Defaults to `[]` (no arguments) if omitted. */
        args?: TypeOrAlias[];
        /** Return type. Defaults to `'void'` if omitted. */
        returns?: TypeOrAlias;
        /** Number of fixed arguments for variadic functions. */
        fixed?: number;
    }

    export type MapToJsType<T extends TypeOrAlias | undefined> = T extends TypeAlias
        ? TypeAliasMap[T]
        : T extends SimpleType
            ? ReturnType<T["fromBuffer"]>
            : void;

    export type MapArrayToJsType<T extends TypeOrAlias[]> = {
        [key in keyof T]: MapToJsType<T[key]>;
    };

    export interface DlopenResult<T extends Record<string, DlopenSymbol>> {
        /** Object containing callable functions for each declared symbol. */
        symbols: {
            [K in keyof T]: T[K]["args"] extends TypeOrAlias[]
                ? (...args: MapArrayToJsType<T[K]["args"]>) => MapToJsType<T[K]["returns"]>
                : () => MapToJsType<T[K]["returns"]>;
        };
        /** Close the shared library handle. */
        close(): void;
    }

    /**
     * Load a shared library and bind symbols as callable functions.
     *
     * Types can be specified as {@link SimpleType} objects or as string aliases
     * (e.g. `'i32'`, `'string'`, `'ptr'`).
     *
     * ```js
     * import { dlopen } from 'tjs:ffi';
     *
     * const { symbols, close } = dlopen('./libfoo.dylib', {
     *     add: { args: ['i32', 'i32'], returns: 'i32' },
     *     version: { args: [], returns: 'string' },
     * });
     *
     * console.log(symbols.add(1, 2));
     * console.log(symbols.version());
     * close();
     * ```
     *
     * @param path - Path to the shared library.
     * @param symbols - Object mapping symbol names to their type signatures.
     */
    export function dlopen<T extends Record<string, DlopenSymbol>>(path: string, symbols: T): DlopenResult<T>;

    /**
     * Default export: the module namespace object, with every named export as a
     * property. Both `import ffi from 'tjs:ffi'` (then `ffi.dlopen(...)`) and
     * `import { dlopen } from 'tjs:ffi'` are supported.
     */
    const _default: {
        DlSymbol: typeof DlSymbol;
        Lib: typeof Lib;
        AdvancedType: typeof AdvancedType;
        CFunction: typeof CFunction;
        Pointer: typeof Pointer;
        PointerType: typeof PointerType;
        StructType: typeof StructType;
        ArrayType: typeof ArrayType;
        StaticStringType: typeof StaticStringType;
        JSCallback: typeof JSCallback;
        ExternalArrayBuffer: typeof ExternalArrayBuffer;
        types: typeof types;
        read: typeof read;
        suffix: typeof suffix;
        errno: typeof errno;
        strerror: typeof strerror;
        bufferToString: typeof bufferToString;
        stringToBuffer: typeof stringToBuffer;
        bufferToPointer: typeof bufferToPointer;
        dlopen: typeof dlopen;
    };
    export default _default;
}
