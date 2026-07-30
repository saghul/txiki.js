/**
 * Foreign Function Interface module.
 *
 * Call native C library functions directly from JavaScript. Supports loading
 * shared libraries, defining function signatures, and working with C types
 * including structs, pointers, and callbacks.
 *
 * ```js
 * import { dlopen, LIBC_NAME } from 'tjs:ffi';
 *
 * const { symbols } = dlopen(LIBC_NAME, {
 *     getpid: { returns: 'i32' },
 * });
 * console.log(`PID: ${symbols.getpid()}`);
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
        /**
         * The raw address as a `bigint`. Paired with {@link createPointer},
         * which rebuilds a pointer from this value: `createPointer(p.value)`
         * reproduces `p` exactly.
         *
         * This is the supported way to move a pointer to a **Worker**. A
         * `NativePointer` is not structured-cloneable, so you cannot
         * `postMessage` it directly; send `p.value` (a `bigint`, which clones
         * by value) and call `createPointer()` on the other side. It works
         * because txiki.js Workers are threads of the **same process** and
         * share one address space — the address is valid on both sides.
         *
         * The address is a plain number: nothing keeps the memory it refers to
         * alive, and nothing makes the target C API safe to call from another
         * thread. The sender must ensure the memory outlives every use, and
         * that touching it off-thread is actually allowed by that library (many
         * — e.g. SDL rendering — are single-threaded or main-thread-only).
         */
        readonly value: bigint;
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
        /** A `void*`. A NULL pointer marshals to and from `null`. */
        pointer: SimpleType<NativePointer | null>,
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

        /**
         * A C flag one byte wide — C99 `bool`, ObjC `BOOL` — carried as a JS
         * boolean. Anything nonzero reads back as `true`.
         */
        bool_u8: SimpleType<boolean>,
        /** A C flag four bytes wide — Win32 `BOOL` — carried as a JS boolean. */
        bool_u32: SimpleType<boolean>,

        jscallback: <T extends JSCallback>() => SimpleType<T>,
    }

    /**
     * Platform-specific shared library file extension: `'dylib'` on macOS,
     * `'so'` on Linux, `'dll'` on Windows.
     */
    export const suffix: string;

    /**
     * The platform's C library: `'libSystem.dylib'` on macOS, `'msvcrt.dll'` on
     * Windows, libc's SONAME on Linux. Pass it to {@link dlopen} to bind a libc
     * symbol portably.
     */
    export const LIBC_NAME: string;

    /** The platform's math library, in the same vein as {@link LIBC_NAME}. */
    export const LIBM_NAME: string;

    export function bufferToString(buf: Uint8Array): string;
    export function stringToBuffer(s: string): Uint8Array;
    export function bufferToPointer(buf: Uint8Array): NativePointer;

    /**
     * Rebuild a {@link NativePointer} from a raw address obtained via
     * {@link NativePointer.value}. The argument **must** be a `bigint` (a
     * number is rejected — it cannot represent every 64-bit address exactly);
     * `0n` returns `null`, matching how null pointers are represented.
     *
     * The main use is moving a pointer to a Worker: `postMessage(p.value)`,
     * then `createPointer(addr)` on the receiving thread. See
     * {@link NativePointer.value} for why this is valid and for the lifetime
     * and thread-safety caveats — this fabricates a pointer from an arbitrary
     * integer, so dereferencing a bogus address is undefined behaviour.
     */
    export function createPointer(value: bigint): NativePointer | null;

    export class Pointer<T, N extends number>{
        constructor(addr: NativePointer | null, level: N, type: SimpleType<T>);
        /** `null` when the pointer is NULL, i.e. when {@link isNull} is `true`. */
        readonly addr: NativePointer | null;
        readonly level: N;
        readonly type: SimpleType<T>;
        readonly isNull: boolean;

        deref(): N extends 1 ? T : Pointer<T, any>;

        derefAll(): T;

        static createRef<T>(type: SimpleType<T>, data: T): Pointer<T, 1>;
        static createRefFromBuf<T>(type: SimpleType<T>, buf: Uint8Array): Pointer<T, 1>;
    }

    export class PointerType<T, ST extends SimpleType<T>, N extends number = 1> extends AdvancedType<Pointer<T, N>, PointerType<T, ST, N>>{
        constructor(type: ST, level?: N);
        toBuffer(data: Pointer<T, N>|NativePointer|null, ctx?: {}): Uint8Array;
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

    /**
     * The JS side of a struct: a plain object keyed by field name, as passed to
     * {@link StructDef.pack} and returned by {@link StructDef.unpack}.
     *
     * The field types are not tracked: a struct is described at runtime by a
     * list of `[ name, type ]` entries, so TypeScript cannot know that `x` is a
     * `number` and `name` a `string`. Values are typed `any` rather than
     * `unknown` so that reading a field back needs no cast.
     */
    export type StructValues = Record<string, any>;

    /**
     * A name -> value mapping over an integer field, from {@link defineEnum}.
     *
     * Usable as a {@link defineStruct} field type (or as the element type of a
     * `[ elementType ]` field), where it packs from a member name and unpacks
     * back to one. It is not a {@link SimpleType}, so it cannot be a
     * {@link dlopen} argument or return type on its own — pass
     * {@link EnumDef.type} for that.
     */
    export interface EnumDef {
        /** The mapping the enum was defined with, frozen. */
        readonly members: Readonly<Record<string, number>>;
        /**
         * The integer type the enum is stored in, i.e. what libffi lays out.
         * Defaults to `types.sint`, which is what a C compiler gives an enum
         * whose enumerators fit in an `int`.
         */
        readonly type: SimpleType<number>;
        /** Size in bytes of {@link EnumDef.type}. */
        readonly size: number;
        /** A description of the mapping, e.g. `'enum(RED, GREEN, BLUE)'`. */
        readonly name: string;
        /**
         * The integer for a member name, or for a value that is already one of
         * the enum's; `undefined` for anything else.
         */
        valueFor(nameOrValue: string | number | bigint): number | undefined;
        /** The member name for a value, `undefined` if the enum has none. */
        nameFor(value: number | bigint): string | undefined;
    }

    /**
     * What a {@link defineStruct} field may be declared as:
     *
     * - a primitive, by {@link TypeAlias} or as a {@link types} object —
     *   including `'cstring'` (a `char *`, packed from and unpacked to a JS
     *   string, `null` for a null pointer), `'pointer'` (a
     *   {@link NativePointer} or `null`) and `'bool_u8'` / `'bool_u32'`;
     * - another {@link StructDef}, laid out inline by value (or behind a
     *   pointer with {@link StructFieldOptions.asPointer});
     * - an {@link EnumDef};
     * - an {@link ArrayType} or {@link StaticStringType}, for an array laid out
     *   *inside* the struct (`int cells[4]`, `char name[8]`);
     * - `[ elementType ]`, a pointer to a run of elements whose count lives in
     *   the field that names this one in {@link StructFieldOptions.lengthOf}.
     */
    export type StructFieldType = TypeOrAlias | StructDef | EnumDef | [StructFieldType];

    /**
     * Runs on pack and rejects a value by throwing. It sees the value as the
     * caller gave it (or the field's `default`), before any
     * {@link StructFieldOptions.packTransform}.
     *
     * @param value - The value about to be packed.
     * @param field - The field's name, for the error message.
     * @param context - `{ input }`, the whole object being packed.
     */
    export type StructValidator = (value: any, field: string, context: { input: StructValues }) => void;

    /** Per-field options, the third element of a {@link StructField} entry. */
    export interface StructFieldOptions {
        /**
         * Value to pack when the field is absent from the object. Absent means
         * `undefined`: `null` is a value a `'pointer'` or `'cstring'` field
         * takes, and is packed as a null address. Wins over `optional`.
         */
        default?: any;
        /**
         * When `true`, an absent field is zeroed instead of throwing — which
         * unpacks back as `0`, `false`, or `null` for a pointer or a string.
         */
        optional?: boolean;
        /** One validator, or a list of them; every one runs. */
        validate?: StructValidator | StructValidator[];
        /** Maps the value the caller gave to the one the field stores. */
        packTransform?: (value: any) => any;
        /** Maps the stored value back on the way out of `unpack`. */
        unpackTransform?: (value: any) => any;
        /**
         * Answered once, when the struct is defined: a field whose condition
         * returns `false` is not part of the struct at all, so it neither shows
         * up in the layout nor shifts the fields after it. This is how a member
         * only some platforms have is expressed.
         */
        condition?: () => boolean;
        /**
         * Names the field this one holds the element count of — a
         * `[ elementType ]` field, or a `'cstring'` field, which pairs into C's
         * counted string. The count is written by the field it counts, so this
         * field's own value is never read from the object being packed, and
         * `default`, `optional`, `validate` and `packTransform` are rejected on
         * it.
         */
        lengthOf?: string;
        /**
         * For a nested {@link StructDef} field: store the address of a buffer of
         * its own instead of laying the struct out inline, i.e. C's
         * `struct limits *`. A null pointer unpacks as `null`.
         */
        asPointer?: boolean;
    }

    /** One entry of a {@link defineStruct} field list. */
    export type StructField =
        | readonly [name: string, type: StructFieldType]
        | readonly [name: string, type: StructFieldType, options: StructFieldOptions];

    /** One field's place in the layout, as reported by {@link StructDef.describe}. */
    export interface StructFieldInfo {
        readonly name: string;
        /** Byte offset from the start of the struct, as computed by libffi. */
        readonly offset: number;
        /** Bytes the field occupies — a pointer's worth for a pointer field. */
        readonly size: number;
        /** The field type's name, e.g. `'type_sint32'`, `'u8[]'`, `'enum(RED, GREEN)'`. */
        readonly type: string;
    }

    /**
     * A struct described with {@link defineStruct}: packs a plain object into
     * struct bytes and unpacks them back.
     *
     * It is an {@link AdvancedType}, so it doubles as a {@link dlopen} argument
     * or return type — its `toBuffer` is {@link StructDef.pack} and its
     * `fromBuffer` is {@link StructDef.unpack} — and a struct is then passed and
     * returned by value.
     */
    export interface StructDef extends AdvancedType<StructValues, SimpleType<StructValues>> {
        /** Struct bytes for `obj`, `size` bytes long. */
        pack(obj: StructValues): Uint8Array;
        /** The object `buf` holds. Reads the struct at offset 0. */
        unpack(buf: ArrayBuffer | ArrayBufferView): StructValues;
        /**
         * Write the fields into an object the caller owns and return it, rather
         * than allocating a result object. Only the struct's own fields are
         * assigned; anything else on `target` is left alone.
         *
         * @param buf - Bytes to read.
         * @param target - Object to assign the fields to.
         * @param offset - Byte offset of the struct within `buf`.
         */
        unpackInto<T extends object>(buf: ArrayBuffer | ArrayBufferView, target: T, offset?: number): T & StructValues;
        /** Unpack `count` structs packed back to back, from offset 0. */
        unpackList(buf: ArrayBuffer | ArrayBufferView, count: number): StructValues[];
        /**
         * Pack a run of structs back to back into a buffer the caller owns,
         * without a buffer per element. Padding between fields keeps whatever
         * the buffer already held.
         *
         * @param objects - The structs to write.
         * @param buf - Buffer to write into; must have room for all of them.
         * @param offset - Byte offset to start at.
         */
        packListInto(objects: readonly StructValues[], buf: ArrayBuffer | ArrayBufferView, offset?: number): void;
        /** Size of the struct in bytes, padding included. */
        readonly size: number;
        /** Alignment of the struct in bytes. */
        readonly align: number;
        /**
         * The fields as `[ name, type ]` pairs, with each type resolved to a
         * type object — a string alias appears as the {@link types} entry it
         * names, and a `[ elementType ]` field as an object whose `name` is
         * `'<element>[]'`. Fields dropped by a
         * {@link StructFieldOptions.condition} are not listed.
         */
        readonly fields: Array<[name: string, type: { readonly name: string }]>;
        /**
         * The layout, field by field: the offsets, sizes and type names libffi
         * computed. The place to look when a struct does not agree with C.
         */
        describe(): StructFieldInfo[];
    }

    /**
     * Describe a C struct as a list of fields, and get back a type that turns a
     * plain JS object into struct bytes and back.
     *
     * The layout is libffi's, so it is the platform's: offsets, size, alignment
     * and padding all match what the C compiler did to the same struct.
     *
     * ```js
     * import { defineStruct } from 'tjs:ffi';
     *
     * // struct point { int x; int y; };
     * const Point = defineStruct([
     *     ['x', 'i32'],
     *     ['y', 'i32'],
     * ]);
     *
     * const bytes = Point.pack({ x: 3, y: 4 });
     *
     * console.log(Point.unpack(bytes)); // { x: 3, y: 4 }
     * ```
     *
     * @param fields - `[ name, type ]` or `[ name, type, options ]` entries.
     */
    export function defineStruct(fields: readonly StructField[]): StructDef;

    /**
     * Describe a C enum as a name -> value mapping, for use as a
     * {@link defineStruct} field type: the field then packs from a member name
     * and unpacks back to one.
     *
     * A name the mapping does not have, or bytes holding a value it has no name
     * for, throw a `RangeError` naming the field. A raw value may be packed as
     * well, but only if the mapping declares it.
     *
     * ```js
     * import { defineEnum, defineStruct } from 'tjs:ffi';
     *
     * // enum log_level { LOG_DEBUG, LOG_INFO, LOG_ERROR };
     * const LogLevel = defineEnum({ DEBUG: 0, INFO: 1, ERROR: 2 });
     * const Message = defineStruct([['level', LogLevel], ['code', 'u32']]);
     *
     * console.log(Message.unpack(Message.pack({ level: 'ERROR', code: 42 })));
     * ```
     *
     * @param members - The enumerators, as `{ NAME: value }`. Values must be
     *                  safe integers; two names for one value is legal C, and
     *                  the last one declared is what unpacking reports.
     * @param type - The integer type the enum is stored in. Defaults to
     *               `types.sint` (C's `int`), which is also the only default
     *               under which a negative enumerator round trips.
     */
    export function defineEnum(members: Record<string, number>, type?: TypeOrAlias): EnumDef;

    /** Options for {@link allocStruct}. */
    export interface AllocStructOptions {
        /**
         * How many elements to allocate for each named array field, as
         * `{ field: count }`. A field named here must be one that has a
         * {@link StructFieldOptions.lengthOf} field pointing at it — for a
         * `'cstring'` field the count is a number of bytes.
         */
        lengths?: Record<string, number>;
    }

    /** What {@link allocStruct} hands back. */
    export interface AllocatedStruct {
        /**
         * Zeroed struct bytes, with the address and count of every requested
         * array field already written. Pass them where C wants a
         * `struct foo *`, then {@link StructDef.unpack} them to read the result.
         */
        bytes: Uint8Array;
        /**
         * The element buffer allocated for each field named in
         * {@link AllocStructOptions.lengths} — the very memory the struct points
         * at, not a copy.
         */
        arrays: Record<string, Uint8Array>;
    }

    /**
     * Allocate struct bytes for a C function to fill in, with a buffer per named
     * array field wired up as if {@link StructDef.pack} had written a run of
     * that many elements.
     *
     * ```js
     * import { allocStruct, defineStruct } from 'tjs:ffi';
     *
     * // struct int_list { unsigned count; int *items; };
     * const IntList = defineStruct([
     *     ['count', 'u32', { lengthOf: 'items' }],
     *     ['items', ['int']],
     * ]);
     *
     * const { bytes } = allocStruct(IntList, { lengths: { items: 4 } });
     *
     * symbols.fill_int_list(bytes);     // void fill_int_list(struct int_list *);
     * console.log(IntList.unpack(bytes));
     * ```
     *
     * @param def - The struct to allocate.
     * @param options - Which array fields to allocate room for.
     */
    export function allocStruct(def: StructDef, options?: AllocStructOptions): AllocatedStruct;

    export function errno(): number;
    export function strerror(err?: number): string;
    export class JSCallback<RT = unknown, AT extends unknown[] = unknown[]>{
        constructor(rtype: SimpleType<RT>, argtypes: { [key in keyof AT]: SimpleType<AT[key]> }, func: (...args: AT) => RT);
        readonly addr: NativePointer;
    }

    /**
     * Type alias -> the {@link types} entry it resolves to.
     *
     * This is the single source of truth for what an alias means: the JS types
     * in {@link TypeAliasMap} are derived from it, so a string alias and the
     * equivalent {@link types} object always marshal to the same JS type.
     */
    export type TypeAliasTypeMap = {
        readonly 'void': typeof types.void;
        readonly 'u8': typeof types.uint8;
        readonly 'uint8': typeof types.uint8;
        readonly 'uint8_t': typeof types.uint8;
        readonly 'i8': typeof types.sint8;
        readonly 'sint8': typeof types.sint8;
        readonly 'int8_t': typeof types.sint8;
        readonly 'u16': typeof types.uint16;
        readonly 'uint16': typeof types.uint16;
        readonly 'uint16_t': typeof types.uint16;
        readonly 'i16': typeof types.sint16;
        readonly 'sint16': typeof types.sint16;
        readonly 'int16_t': typeof types.sint16;
        readonly 'u32': typeof types.uint32;
        readonly 'uint32': typeof types.uint32;
        readonly 'uint32_t': typeof types.uint32;
        readonly 'int': typeof types.sint32;
        readonly 'i32': typeof types.sint32;
        readonly 'sint32': typeof types.sint32;
        readonly 'int32_t': typeof types.sint32;
        readonly 'u64': typeof types.uint64;
        readonly 'uint64': typeof types.uint64;
        readonly 'uint64_t': typeof types.uint64;
        readonly 'i64': typeof types.sint64;
        readonly 'sint64': typeof types.sint64;
        readonly 'int64_t': typeof types.sint64;
        readonly 'f32': typeof types.float;
        readonly 'float': typeof types.float;
        readonly 'f64': typeof types.double;
        readonly 'double': typeof types.double;
        readonly 'pointer': typeof types.pointer;
        readonly 'ptr': typeof types.pointer;
        readonly 'string': typeof types.string;
        readonly 'cstring': typeof types.string;
        readonly 'buffer': typeof types.buffer;
        readonly 'bool_u8': typeof types.bool_u8;
        readonly 'bool_u32': typeof types.bool_u32;
        readonly 'uchar': typeof types.uchar;
        readonly 'schar': typeof types.schar;
        readonly 'char': typeof types.schar;
        readonly 'ushort': typeof types.ushort;
        readonly 'sshort': typeof types.sshort;
        readonly 'uint': typeof types.uint;
        readonly 'sint': typeof types.sint;
        readonly 'ulong': typeof types.ulong;
        readonly 'slong': typeof types.slong;
        readonly 'long': typeof types.slong;
        readonly 'size_t': typeof types.size;
        readonly 'ssize_t': typeof types.ssize;
    };

    /** Type conversion map (FFI type alias -> JS type) */
    export type TypeAliasMap = {
        readonly [K in keyof TypeAliasTypeMap]: ReturnType<TypeAliasTypeMap[K]['fromBuffer']>;
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
     * Describes a native symbol for use with {@link dlopen}.
     *
     * An entry with `type` declares a data symbol (a global variable); any other
     * entry declares a function.
     *
     * The key an entry is listed under is the JS property name it binds to, and
     * by default also the C symbol resolved; `name` separates the two.
     */
    export interface DlopenSymbol {
        /**
         * C symbol to resolve. Defaults to the key the entry is listed under.
         *
         * Set it to bind one C symbol more than once — a variadic function needs
         * a binding per arity — or to expose a C name under a friendlier one.
         */
        name?: string;
        /**
         * When `true`, a symbol that cannot be resolved is left out of
         * `symbols` instead of making the whole {@link dlopen} throw — use
         * `'foo' in symbols` to find out whether this build of the library has
         * it. Only resolution is affected; any other failure still throws.
         */
        optional?: boolean;
        /** Argument types. Defaults to `[]` (no arguments) if omitted. */
        args?: TypeOrAlias[];
        /** Return type. Defaults to `'void'` if omitted. */
        returns?: TypeOrAlias;
        /** Number of fixed arguments for variadic functions. */
        fixed?: number;
        /**
         * Type of a global variable. The symbol binds to a level-1
         * {@link Pointer} at the variable's address instead of a callable, so
         * `symbols.foo.deref()` reads it. A global with a deeper indirection is
         * reached by rebuilding the pointer: `new Pointer(symbols.foo.addr, 2,
         * type)`.
         *
         * Mutually exclusive with `args` and `returns`; an entry carrying both
         * throws a `TypeError`.
         */
        type?: TypeOrAlias;
    }

    export type MapToJsType<T extends TypeOrAlias | undefined> = T extends TypeAlias
        ? TypeAliasMap[T]
        : T extends SimpleType
            ? ReturnType<T["fromBuffer"]>
            : void;

    export type MapArrayToJsType<T extends TypeOrAlias[]> = {
        [key in keyof T]: MapToJsType<T[key]>;
    };

    /** What a single {@link DlopenSymbol} binds to: a Pointer, or a callable. */
    export type MapSymbolToJsValue<S extends DlopenSymbol> = S["type"] extends TypeOrAlias
        ? Pointer<MapToJsType<S["type"]>, 1>
        : S["args"] extends TypeOrAlias[]
            ? (...args: MapArrayToJsType<S["args"]>) => MapToJsType<S["returns"]>
            : () => MapToJsType<S["returns"]>;

    export interface DlopenResult<T extends Record<string, DlopenSymbol>> extends Disposable {
        /**
         * Object containing a callable function for each declared function
         * symbol, and a {@link Pointer} for each declared data symbol. An entry
         * declared `optional` is absent when its symbol did not resolve.
         */
        symbols: {
            [K in keyof T as T[K]["optional"] extends true ? never : K]: MapSymbolToJsValue<T[K]>;
        } & {
            [K in keyof T as T[K]["optional"] extends true ? K : never]?: MapSymbolToJsValue<T[K]>;
        };
        /**
         * Close the shared library handle. Aliased as `Symbol.dispose`, so
         * `using lib = dlopen(...)` closes it at scope exit.
         */
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

    /** Result of {@link dlopenCProto}. */
    export interface DlopenCProtoResult extends Disposable {
        /**
         * A callable for each function the header declared, keyed by its C name.
         * The header is parsed at runtime, so the signatures are not known to
         * TypeScript.
         */
        symbols: Record<string, (...args: any[]) => any>;
        /**
         * The types the header declared — structs, typedefs, and the pointer
         * types derived from them — keyed by the name they were declared under:
         * `'struct test'` for `struct test { ... }`, `'s_test'` for a typedef of
         * it, `'s_test*'` for a pointer to it. Words in a multi-word type name
         * are sorted, since their order is not significant in C.
         *
         * Use these to build arguments, e.g.
         * `Pointer.createRef(types.get('struct test'), { a: 1 })`.
         */
        types: Map<string, SimpleType>;
        /**
         * Close the shared library handle. Aliased as `Symbol.dispose`, so
         * `using lib = dlopenCProto(...)` closes it at scope exit.
         */
        close(): void;
    }

    /**
     * Load a shared library and bind every function declared in a C header
     * snippet, which also defines the structs and typedefs those functions use.
     *
     * ```js
     * import { dlopenCProto, Pointer } from 'tjs:ffi';
     *
     * const { symbols, types, close } = dlopenCProto('./libfoo.dylib', `
     *     struct point { int x; int y; };
     *     int distance(struct point* a, struct point* b);
     * `);
     *
     * const point = types.get('struct point');
     *
     * console.log(symbols.distance(
     *     Pointer.createRef(point, { x: 0, y: 0 }),
     *     Pointer.createRef(point, { x: 3, y: 4 })));
     * close();
     * ```
     *
     * @param path - Path to the shared library.
     * @param header - C declarations: function prototypes, structs, typedefs.
     */
    export function dlopenCProto(path: string, header: string): DlopenCProtoResult;

    /**
     * Default export: the module namespace object, with every named export as a
     * property. Both `import ffi from 'tjs:ffi'` (then `ffi.dlopen(...)`) and
     * `import { dlopen } from 'tjs:ffi'` are supported.
     */
    const _default: {
        AdvancedType: typeof AdvancedType;
        Pointer: typeof Pointer;
        PointerType: typeof PointerType;
        StructType: typeof StructType;
        ArrayType: typeof ArrayType;
        StaticStringType: typeof StaticStringType;
        defineStruct: typeof defineStruct;
        defineEnum: typeof defineEnum;
        allocStruct: typeof allocStruct;
        JSCallback: typeof JSCallback;
        ExternalArrayBuffer: typeof ExternalArrayBuffer;
        types: typeof types;
        read: typeof read;
        suffix: typeof suffix;
        LIBC_NAME: typeof LIBC_NAME;
        LIBM_NAME: typeof LIBM_NAME;
        errno: typeof errno;
        strerror: typeof strerror;
        bufferToString: typeof bufferToString;
        stringToBuffer: typeof stringToBuffer;
        bufferToPointer: typeof bufferToPointer;
        createPointer: typeof createPointer;
        dlopen: typeof dlopen;
        dlopenCProto: typeof dlopenCProto;
    };
    export default _default;
}
