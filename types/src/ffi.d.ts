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
    export type PointerAddr = number;

    export class DlSymbol{
        readonly addr: PointerAddr;
    }

    interface SimpleType<T = any>{
        toBuffer(data: T, ctx?: {}): Uint8Array;
        fromBuffer(buffer: Uint8Array, ctx?: {}): T;
        readonly size: number;
        readonly name: string;
    }

    export class AdvancedType<T, ST extends SimpleType<T>> implements SimpleType<T>{
        constructor(type: ST, conf: {
            toBuffer?: (data: T, ctx?: {}) => Uint8Array,
            fromBuffer?: (buf: Uint8Array, ctx?: {}) => T,
            getFfiTypeStruct?: () => SimpleType<T>
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

    export class CFunction<JRT = any, JAT extends Array<any> = any[]>{ //TODO: better typing mechanism for Arg types
        constructor(symbol: DlSymbol, rtype: SimpleType<JRT>, argtypes: SimpleType[], fixed?: number);
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
        pointer: SimpleType<PointerAddr>,
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

        string: SimpleType<string>
        
        buffer: SimpleType<Uint8Array>
        
        jscallback: SimpleType<(...args: any)=>any>
    }

    export function bufferToString(buf: Uint8Array): string;
    export function stringToBuffer(s: string): Uint8Array;

    export class Pointer<T, N extends number>{
        constructor(addr: PointerAddr, level: N, type: SimpleType<T>);
        readonly addr: PointerAddr;
        readonly level: N;
        readonly type: T;
        readonly isNull: boolean;
        
        deref(): N extends 1 ? T : Pointer<T, any>;
        
        derefAll(): T;
        
        static createRef<T>(type: SimpleType<T>, data: T): Pointer<T, 1>;
        static createRefFromBuf<T>(type: SimpleType<T>, buf: Uint8Array): Pointer<T, 1>;
    }

    export class PointerType<T, ST extends SimpleType<T>, N extends number> extends AdvancedType<Pointer<T, N>, PointerType<T, ST, N>>{
        constructor(type: ST , level: N);
        toBuffer(data: Pointer<T, N>|PointerAddr, ctx?: {}): Uint8Array;
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

    export class StaticStringType extends AdvancedType<string, StaticStringType>{
        constructor(length: number, name: string);
        toBuffer(str: string, ctx?: {}): Uint8Array;
        fromBuffer(buf: Uint8Array, ctx?: {}): string;
    }

    export function errno(): number;
    export function strerror(err?: number): string;
    export class JSCallback<RT, AT extends []>{ //TODO: better typing mechanism for Arg types
        constructor(rtype: SimpleType<RT>, argtypes: Array<SimpleType<AT[0]>>, func: (...args: AT)=>RT);
        readonly addr: PointerAddr;
    }

    /**
     * String aliases for FFI types. Can be used in {@link dlopen} symbol definitions
     * instead of type objects from {@link types}.
     *
     * Supports short (`i32`, `u8`, `f64`, `ptr`), C-style (`int`, `char`, `double`),
     * and stdint-style (`uint32_t`, `int64_t`) names.
     */
    export type TypeAlias =
        | 'void'
        | 'u8' | 'uint8' | 'uint8_t'
        | 'i8' | 'sint8' | 'int8_t'
        | 'u16' | 'uint16' | 'uint16_t'
        | 'i16' | 'sint16' | 'int16_t'
        | 'u32' | 'uint32' | 'uint32_t' | 'int'
        | 'i32' | 'sint32' | 'int32_t'
        | 'u64' | 'uint64' | 'uint64_t'
        | 'i64' | 'sint64' | 'int64_t'
        | 'f32' | 'float'
        | 'f64' | 'double'
        | 'pointer' | 'ptr'
        | 'string' | 'cstring'
        | 'buffer'
        | 'uchar' | 'schar' | 'char'
        | 'ushort' | 'sshort'
        | 'uint' | 'sint'
        | 'ulong' | 'slong' | 'long'
        | 'size_t' | 'ssize_t';

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

    export interface DlopenResult<T extends Record<string, DlopenSymbol>> {
        /** Object containing callable functions for each declared symbol. */
        symbols: { [K in keyof T]: (...args: any[]) => any };
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
}
