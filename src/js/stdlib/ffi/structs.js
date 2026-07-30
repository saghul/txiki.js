// Declarative struct packing: defineStruct([ [ name, type, options ], ... ]) hands
// back a type that turns plain JS objects into struct bytes and back.
//
// Ported from bun-ffi-structs v0.3.1 (https://github.com/anomalyco/bun-ffi-structs),
// MIT licensed, Copyright 2025 Anomaly. The declarative surface (pack / unpack /
// describe over a list of fields), the field options and the pointer-target
// retention model come from there. The layout does not: libffi computes the
// offsets, the size and the alignment here, instead of a JS loop assuming
// `align == size` on a little-endian machine.

// Whether this machine is little-endian, probed rather than assumed: DataView
// reads big-endian by default, so a 1 that reads back as 1 means a big-endian
// host.
const LE = new DataView(new Uint16Array([ 1 ]).buffer).getUint16(0) !== 1;

export default function buildDefineStruct(
    { AdvancedType, ArrayType, StructType, types, resolveType, typeName, createPointer, bufferToPointer, isPointer }) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const pointerSize = types.pointer.size;

    // Maps the ArrayBuffer holding packed struct bytes to the JS objects whose
    // addresses were written into it. A raw address is invisible to the GC, so
    // without this a cstring field's bytes could be collected while C still
    // holds the pointer.
    const retainedTargets = new WeakMap();

    function retain(owner, target) {
        const targets = retainedTargets.get(owner);

        if (targets) {
            targets.push(target);
        } else {
            retainedTargets.set(owner, [ target ]);
        }
    }

    function readAddress(view, off) {
        return pointerSize === 8 ? view.getBigUint64(off, LE) : BigInt(view.getUint32(off, LE));
    }

    function writeAddress(view, off, addr) {
        if (pointerSize === 8) {
            view.setBigUint64(off, addr, LE);
        } else {
            view.setUint32(off, Number(BigInt.asUintN(32, addr)), LE);
        }
    }

    // A DataView accessor pair per scalar type, keyed by the resolved type
    // object. The integer width comes from the libffi type rather than a table
    // of its own, so `long` and `size_t` fields follow the platform.
    function intAccessors(type, signed) {
        switch (type.size) {
            case 1:
                return signed
                    ? { get: (v, o) => v.getInt8(o), set: (v, o, x) => v.setInt8(o, x) }
                    : { get: (v, o) => v.getUint8(o), set: (v, o, x) => v.setUint8(o, x) };
            case 2:
                return signed
                    ? { get: (v, o) => v.getInt16(o, LE), set: (v, o, x) => v.setInt16(o, x, LE) }
                    : { get: (v, o) => v.getUint16(o, LE), set: (v, o, x) => v.setUint16(o, x, LE) };
            case 4:
                return signed
                    ? { get: (v, o) => v.getInt32(o, LE), set: (v, o, x) => v.setInt32(o, x, LE) }
                    : { get: (v, o) => v.getUint32(o, LE), set: (v, o, x) => v.setUint32(o, x, LE) };
            // 64-bit integer fields are BigInts, the only JS number type that
            // holds them exactly; a plain number is accepted on the way in.
            case 8:
                return signed
                    ? { get: (v, o) => v.getBigInt64(o, LE), set: (v, o, x) => v.setBigInt64(o, BigInt(x), LE) }
                    : { get: (v, o) => v.getBigUint64(o, LE), set: (v, o, x) => v.setBigUint64(o, BigInt(x), LE) };
        }

        throw new TypeError(`unsupported integer size: ${type.size}`);
    }

    const scalarAccessors = new Map();
    const unsignedTypes = [ types.uint8, types.uint16, types.uint32, types.uint64,
        types.uchar, types.ushort, types.uint, types.ulong, types.ullong, types.size ];
    const signedTypes = [ types.sint8, types.sint16, types.sint32, types.sint64,
        types.schar, types.sshort, types.sint, types.slong, types.sllong, types.ssize ];

    for (const type of unsignedTypes) {
        scalarAccessors.set(type, intAccessors(type, false));
    }

    for (const type of signedTypes) {
        scalarAccessors.set(type, intAccessors(type, true));
    }

    const integerTypes = new Set([ ...unsignedTypes, ...signedTypes ]);

    scalarAccessors.set(types.float, {
        get: (v, o) => v.getFloat32(o, LE),
        set: (v, o, x) => v.setFloat32(o, x, LE),
    });
    scalarAccessors.set(types.double, {
        get: (v, o) => v.getFloat64(o, LE),
        set: (v, o, x) => v.setFloat64(o, x, LE),
    });
    scalarAccessors.set(types.bool_u8, {
        get: (v, o) => Boolean(v.getUint8(o)),
        set: (v, o, x) => v.setUint8(o, x ? 1 : 0),
    });
    scalarAccessors.set(types.bool_u32, {
        get: (v, o) => Boolean(v.getUint32(o, LE)),
        set: (v, o, x) => v.setUint32(o, x ? 1 : 0, LE),
    });
    scalarAccessors.set(types.pointer, {
        get: (v, o) => createPointer(readAddress(v, o)),
        set: (v, o, p) => {
            if (p === null) {
                writeAddress(v, o, 0n);

                return;
            }

            if (!isPointer(p)) {
                throw new TypeError('a pointer field takes a native pointer or null');
            }

            writeAddress(v, o, p.value);
        },
    });

    const cstringAccessors = {
        get: (v, o) => {
            if (readAddress(v, o) === 0n) {
                return null;
            }

            // Copy the bytes into a JS string. A view built from the address
            // would alias foreign memory that nothing keeps alive (the pointer
            // may well be a C string owned by the library), so it must not
            // escape from here.
            return types.string.fromBuffer(new Uint8Array(v.buffer, v.byteOffset + o, pointerSize));
        },
        set: (v, o, str) => {
            if (str === null) {
                writeAddress(v, o, 0n);

                return;
            }

            const bytes = encoder.encode(str + '\0');

            writeAddress(v, o, bufferToPointer(bytes).value);
            retain(v.buffer, bytes);
        },
    };

    // A `char *` whose length is in a field of its own: C's counted string, which
    // is not required to be terminated at all. Unpacking therefore reads exactly
    // the stored count instead of scanning for a NUL.
    function countedStringAccessors(counter) {
        const { relOffset, get: getLength, set: setLength } = counter;

        return {
            get: (v, o) => {
                const addr = readAddress(v, o);

                if (addr === 0n) {
                    return null;
                }

                const length = Number(getLength(v, o + relOffset));

                if (length === 0) {
                    return '';
                }

                return decoder.decode(createPointer(addr).toUint8Array(length));
            },
            set: (v, o, str) => {
                if (str === null) {
                    writeAddress(v, o, 0n);
                    setLength(v, o + relOffset, 0);

                    return;
                }

                const bytes = encoder.encode(str + '\0');

                writeAddress(v, o, bufferToPointer(bytes).value);
                retain(v.buffer, bytes);
                // The terminator is written but not counted: a consumer that goes
                // by the length sees exactly the string, and one that expects a C
                // string still finds its NUL.
                setLength(v, o + relOffset, bytes.length - 1);
            },
            zero: (v, o) => {
                writeAddress(v, o, 0n);
                setLength(v, o + relOffset, 0);
            },
        };
    }

    // The `[ elementType ]` field syntax: a pointer to a run of elements, whose
    // count lives in whichever field names this one in its `lengthOf`. This is
    // storage of its own, reached through a pointer — an ArrayType field, by
    // contrast, is an array laid out inside the struct.
    class ArrayOf {
        #element;
        #name;

        constructor(element) {
            this.#element = element;
            this.#name = `${typeName(element)}[]`;
        }
        get element() {
            return this.#element;
        }
        get name() {
            return this.#name;
        }
    }

    function arrayPointerAccessors(name, element, counter) {
        const { get: getElement, set: setElement } = accessorsFor(name, element);
        const stride = element.size;
        const { relOffset, get: getLength, set: setLength } = counter;

        return {
            get: (v, o) => {
                const addr = readAddress(v, o);
                const count = Number(getLength(v, o + relOffset));

                if (addr === 0n) {
                    if (count !== 0) {
                        throw new RangeError(
                            `struct field '${name}': a null pointer with a count of ${count}`);
                    }

                    return [];
                }

                if (count === 0) {
                    return [];
                }

                // The elements are copied out one at a time rather than handed
                // back as a view over the pointer: NativePointer.toArrayBuffer()
                // aliases foreign memory and keeps nothing alive, so a view would
                // outlive whatever owns the bytes — the library's own allocation,
                // or a buffer this struct retained and the caller then dropped.
                // An array of copies cannot dangle.
                const bytes = createPointer(addr).toUint8Array(count * stride);
                const elements = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                const result = new Array(count);

                for (let i = 0; i < count; i++) {
                    result[i] = getElement(elements, i * stride);
                }

                return result;
            },
            set: (v, o, values) => {
                const count = values === null ? 0 : values.length;

                // Anything else would take `undefined` as the count and quietly
                // write a run of no elements.
                if (!Number.isSafeInteger(count) || count < 0) {
                    throw new TypeError(
                        `struct field '${name}': an array field takes a list of elements or null, ` +
                        `got: ${String(values)}`);
                }

                if (count === 0) {
                    writeAddress(v, o, 0n);
                    setLength(v, o + relOffset, 0);

                    return;
                }

                const bytes = new Uint8Array(count * stride);
                const elements = new DataView(bytes.buffer);

                for (let i = 0; i < count; i++) {
                    setElement(elements, i * stride, values[i]);
                }

                writeAddress(v, o, bufferToPointer(bytes).value);
                // The element bytes are a JS allocation whose address now lives in
                // the struct, where the GC cannot see it. An element that is itself
                // a cstring or an array retained its own target against `bytes`,
                // and holding `bytes` here keeps that WeakMap entry alive too.
                retain(v.buffer, bytes);
                setLength(v, o + relOffset, count);
            },
            zero: (v, o) => {
                writeAddress(v, o, 0n);
                setLength(v, o + relOffset, 0);
            },
        };
    }

    // Module-private access to a StructDef's own layout, so that a nested struct
    // can be packed straight into the outer bytes and unpacked straight out of
    // them, at any offset and without a buffer in between.
    let unpackStructAt;
    let packStructAt;
    let structArrays;

    function nestedAccessors(def) {
        return {
            get: (v, o) => unpackStructAt(def, v, o),
            set: (v, o, obj) => packStructAt(def, v, o, obj),
        };
    }

    // `asPointer`: the nested struct gets a buffer of its own and the field holds
    // its address, rather than the struct being laid out inline.
    function structPointerAccessors(def) {
        return {
            get: (v, o) => {
                const addr = readAddress(v, o);

                if (addr === 0n) {
                    return null;
                }

                const bytes = createPointer(addr).toUint8Array(def.size);

                return unpackStructAt(def, new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), 0);
            },
            set: (v, o, obj) => {
                if (obj === null) {
                    writeAddress(v, o, 0n);

                    return;
                }

                const bytes = def.pack(obj);

                writeAddress(v, o, bufferToPointer(bytes).value);
                retain(v.buffer, bytes);
            },
        };
    }

    // An array laid out inside the struct (`char name[16]`, `int grid[4]`).
    // ArrayType already marshals the elements and reports the libffi array type
    // that the layout needs, so all that is left is handing it this field's slice
    // of the struct bytes.
    function inlineArrayAccessors(type) {
        const size = type.size;

        return {
            get: (v, o) => type.fromBuffer(new Uint8Array(v.buffer, v.byteOffset + o, size)),
            set: (v, o, value) => {
                new Uint8Array(v.buffer, v.byteOffset + o, size).set(type.toBuffer(value));
            },
        };
    }

    // A name <-> value mapping over an integer field. The C type behind an enum is
    // not in the mapping, so it is a parameter with a default rather than a guess
    // made from the range of the values: a compiler gives an enum whose
    // enumerators fit in `int` exactly that type, and the values C code cares
    // about (a negative error code, say) only round trip through a signed one.
    class EnumDef {
        #members;
        #names;
        #type;
        #name;

        constructor(members, type) {
            const entries = Object.entries(members);

            if (entries.length === 0) {
                throw new TypeError('defineEnum expects at least one member');
            }

            this.#type = resolveType(type);

            if (!integerTypes.has(this.#type)) {
                throw new TypeError(`defineEnum needs an integer type, got: ${this.#type.name}`);
            }

            // Null-prototype maps, so that a member named 'constructor' or a value
            // that spells 'toString' cannot be answered by Object.prototype.
            this.#members = Object.create(null);
            this.#names = Object.create(null);

            for (const [ member, value ] of entries) {
                if (!Number.isSafeInteger(value)) {
                    throw new TypeError(`enum member '${member}' must be a safe integer, got: ${String(value)}`);
                }

                this.#members[member] = value;
                // Two names for one value is legal C; the last one declared is the
                // one unpacking reports.
                this.#names[value] = member;
            }

            this.#name = `enum(${Object.keys(this.#members).join(', ')})`;
            Object.freeze(this.#members);
        }
        get members() {
            return this.#members;
        }
        // The integer type the enum is stored in, which is what libffi lays out.
        get type() {
            return this.#type;
        }
        get size() {
            return this.#type.size;
        }
        get name() {
            return this.#name;
        }
        // The integer for a member name or for a value that is already a member,
        // undefined for anything else. A raw value is normalised to the number the
        // mapping declared, so a bigint can be handed to a 32-bit enum field.
        valueFor(nameOrValue) {
            if (typeof nameOrValue === 'string') {
                return this.#members[nameOrValue];
            }

            if (typeof nameOrValue === 'number' || typeof nameOrValue === 'bigint') {
                const member = this.#names[nameOrValue];

                return member === undefined ? undefined : this.#members[member];
            }

            return undefined;
        }
        nameFor(value) {
            return this.#names[value];
        }
    }

    function enumAccessors(name, def) {
        const base = scalarAccessors.get(def.type);

        return {
            get: (v, o) => {
                const raw = base.get(v, o);
                const member = def.nameFor(raw);

                if (member === undefined) {
                    throw new RangeError(`struct field '${name}': ${raw} is not a value of ${def.name}`);
                }

                return member;
            },
            set: (v, o, x) => {
                const value = def.valueFor(x);

                if (value === undefined) {
                    throw new RangeError(`struct field '${name}': ${String(x)} is not a member of ${def.name}`);
                }

                base.set(v, o, value);
            },
        };
    }

    function accessorsFor(name, type) {
        const scalar = scalarAccessors.get(type);

        if (scalar) {
            return scalar;
        }

        if (type === types.string) {
            return cstringAccessors;
        }

        if (type instanceof EnumDef) {
            return enumAccessors(name, type);
        }

        if (type instanceof ArrayType) {
            return inlineArrayAccessors(type);
        }

        if (type instanceof StructDef) {
            return nestedAccessors(type);
        }

        throw new TypeError(`struct field '${name}' has an unsupported type: ${type.name}`);
    }

    const fieldOptions = new Set([
        'asPointer', 'condition', 'default', 'lengthOf', 'optional',
        'packTransform', 'unpackTransform', 'validate',
    ]);

    function checkFieldOptions(name, options) {
        for (const key of Object.keys(options)) {
            // A typo in an option name would otherwise be silently ignored, and a
            // misspelled 'optional' or 'default' reads as a field that has neither.
            if (!fieldOptions.has(key)) {
                throw new TypeError(`struct field '${name}' has an unknown option: '${key}'`);
            }
        }

        for (const key of [ 'condition', 'packTransform', 'unpackTransform' ]) {
            if (options[key] !== undefined && typeof options[key] !== 'function') {
                throw new TypeError(`struct field '${name}': ${key} must be a function`);
            }
        }

        if (options.lengthOf !== undefined && typeof options.lengthOf !== 'string') {
            throw new TypeError(`struct field '${name}': lengthOf must be the name of another field`);
        }
    }

    // A field holding another field's element count. Its value is derived from the
    // field it counts, so the options that would supply or reshape a value of its
    // own are rejected instead of being quietly ignored.
    function checkLengthField(name, type, options, resolved, counted) {
        const target = options.lengthOf;

        if (!integerTypes.has(type)) {
            throw new TypeError(`struct field '${name}': a lengthOf field must be an integer, got: ${type.name}`);
        }

        for (const key of [ 'default', 'packTransform', 'validate' ]) {
            if (options[key] !== undefined) {
                throw new TypeError(
                    `struct field '${name}': lengthOf takes the value from '${target}', so ${key} cannot apply`);
            }
        }

        if (options.optional) {
            throw new TypeError(
                `struct field '${name}': lengthOf takes the value from '${target}', so optional cannot apply`);
        }

        const entry = resolved.find(([ field ]) => field === target);

        if (!entry) {
            throw new TypeError(`struct field '${name}': lengthOf names an unknown field '${target}'`);
        }

        if (!(entry[1] instanceof ArrayOf) && entry[1] !== types.string) {
            throw new TypeError(
                `struct field '${name}': lengthOf names '${target}', ` +
                'which is neither an array field nor a cstring');
        }

        if (counted.has(target)) {
            throw new TypeError(`struct field '${target}' already has a length field`);
        }
    }

    // What libffi is asked to lay the field out as. A pointer to elements and a
    // nested struct stored as a pointer are both an address; an enum is the
    // integer it is stored in.
    function layoutType(type, options) {
        if (type instanceof ArrayOf || options.asPointer) {
            return types.pointer;
        }

        if (type instanceof EnumDef) {
            return type.type;
        }

        return type;
    }

    function fieldStorage(type, options) {
        return type instanceof ArrayOf || options.asPointer ? pointerSize : type.size;
    }

    function resolveFieldType(name, type) {
        if (Array.isArray(type)) {
            if (type.length !== 1) {
                throw new TypeError(
                    `struct field '${name}': a pointer-to-array field is spelled [ elementType ]`);
            }

            return new ArrayOf(resolveType(type[0]));
        }

        return resolveType(type);
    }

    function fieldAccessors(name, type, options, counter) {
        if (type instanceof ArrayOf) {
            if (!counter) {
                throw new TypeError(
                    `struct field '${name}' is a pointer to an array, so another field ` +
                    `needs { lengthOf: '${name}' } to say how many elements there are`);
            }

            return arrayPointerAccessors(name, type.element, counter);
        }

        if (options.asPointer) {
            if (!(type instanceof StructDef)) {
                throw new TypeError(
                    `struct field '${name}': asPointer needs a defineStruct() type, got: ${type.name}`);
            }

            return structPointerAccessors(type);
        }

        if (type === types.string && counter) {
            return countedStringAccessors(counter);
        }

        return accessorsFor(name, type);
    }

    // Zeroing a field is normally a memset of its own bytes; a field paired with a
    // length field also owns bytes outside its extent, so those accessors bring
    // their own.
    function zeroFiller(size) {
        return (view, at) => new Uint8Array(view.buffer, view.byteOffset + at, size).fill(0);
    }

    // The pack side of a field, resolved once here instead of by looking at the
    // options on every pack: a field that uses none of them ends up with the same
    // single write it had before options existed.
    function fieldPacker(name, offset, set, zero, options) {
        const { packTransform, validate } = options;
        let write = packTransform
            ? (view, base, value) => set(view, base + offset, packTransform(value))
            : (view, base, value) => set(view, base + offset, value);

        if (validate !== undefined) {
            const validators = Array.isArray(validate) ? validate : [ validate ];

            for (const fn of validators) {
                if (typeof fn !== 'function') {
                    throw new TypeError(`struct field '${name}': validate must be a function or an array of functions`);
                }
            }

            const packValue = write;

            // A validator sees the value as the caller gave it (or the default),
            // before packTransform: what it is there to reject is the input.
            write = (view, base, value, obj) => {
                for (const fn of validators) {
                    fn(value, name, { input: obj });
                }

                packValue(view, base, value);
            };
        }

        const fallback = options.default;

        // `default` beats `optional`: with both, an absent field packs the default
        // and `optional` only says that its absence is not an error. Only
        // `undefined` counts as absent — null is a value a pointer or a cstring
        // field takes, so it is packed rather than replaced.
        if (fallback !== undefined) {
            return (view, base, obj) => {
                const value = obj[name];

                write(view, base, value === undefined ? fallback : value, obj);
            };
        }

        if (options.optional) {
            return (view, base, obj) => {
                const value = obj[name];

                if (value === undefined) {
                    // Zero bytes, which is what unpack then reads back as: a 0, a
                    // false, or a null for a pointer or a cstring.
                    zero(view, base + offset);

                    return;
                }

                write(view, base, value, obj);
            };
        }

        return (view, base, obj) => {
            const value = obj[name];

            if (value === undefined) {
                throw new TypeError(`missing value for struct field '${name}'`);
            }

            write(view, base, value, obj);
        };
    }

    function toDataView(buf) {
        if (buf instanceof DataView) {
            return buf;
        }

        if (ArrayBuffer.isView(buf)) {
            return new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        }

        return new DataView(buf);
    }

    function checkRange(view, offset, needed) {
        if (!Number.isSafeInteger(offset) || offset < 0) {
            throw new RangeError(`offset must be a non-negative integer, got ${offset}`);
        }

        if (view.byteLength - offset < needed) {
            throw new RangeError(
                `expected at least ${needed} bytes at offset ${offset}, got ${view.byteLength - offset}`);
        }
    }

    function checkCount(count) {
        if (!Number.isSafeInteger(count) || count < 0) {
            throw new RangeError(`count must be a non-negative integer, got ${count}`);
        }
    }

    // A struct is an AdvancedType so that it can be handed to dlopen() as an
    // argument or return type: toBuffer/fromBuffer are pack/unpack.
    class StructDef extends AdvancedType {
        #fields;
        #layout;
        #arrays;

        static {
            unpackStructAt = (def, view, offset) => def.#unpackInto(view, offset, {});
            packStructAt = (def, view, offset, obj) => def.#pack(view, offset, obj);
            structArrays = def => def.#arrays;
        }

        constructor(fields) {
            if (!Array.isArray(fields) || fields.length === 0) {
                throw new TypeError('defineStruct expects a non-empty array of fields');
            }

            // A field whose condition is false is dropped here, before libffi is
            // asked for a layout: the offsets it computes are the struct's for as
            // long as the struct exists, so a condition is answered once, at
            // definition time, and never per pack.
            const resolved = [];

            for (const [ field, type, options = {} ] of fields) {
                checkFieldOptions(field, options);

                if (options.condition && !options.condition()) {
                    continue;
                }

                resolved.push([ field, resolveFieldType(field, type), options ]);
            }

            if (resolved.length === 0) {
                throw new TypeError('every field of the struct was excluded by its condition');
            }

            // Which field holds the count of which, worked out before the layout so
            // that a count may be declared on either side of the field it counts —
            // C puts it first about as often as last.
            const counted = new Map();

            for (const [ field, type, options ] of resolved) {
                if (options.lengthOf === undefined) {
                    continue;
                }

                checkLengthField(field, type, options, resolved, counted);
                counted.set(options.lengthOf, field);
            }

            const name = `struct(${resolved.map(([ field ]) => field).join(', ')})`;
            // libffi is the layout authority: the offsets, the size and the
            // alignment of the struct all come from the ffi_type it prepares.
            const structType = new StructType(
                resolved.map(([ field, type, options ]) => [ field, layoutType(type, options) ]), name);
            const offsets = structType.ffiType.offsets;

            super(structType.ffiType, { name });

            const indexOf = new Map(resolved.map(([ field ], i) => [ field, i ]));

            // The count of a paired field, as an offset relative to that field's
            // own: one accessor then reaches both wherever the struct itself sits —
            // an element of a list, a member of an enclosing struct.
            const counterFor = (field, offset) => {
                const counter = counted.get(field);

                if (counter === undefined) {
                    return null;
                }

                const i = indexOf.get(counter);
                const { get, set } = scalarAccessors.get(resolved[i][1]);

                return { relOffset: offsets[i] - offset, get, set };
            };

            // Frozen because the getter hands the same array out on every access:
            // a caller mutating it would leave the definition misreporting itself
            // while pack/unpack, which read the separate layout, carried on.
            this.#fields = Object.freeze(resolved.map(([ field, type ]) => Object.freeze([ field, type ])));
            this.#arrays = new Map();
            this.#layout = resolved.map(([ field, type, options ], i) => {
                const offset = offsets[i];
                const storage = fieldStorage(type, options);
                const counter = counterFor(field, offset);
                const { get, set, zero = zeroFiller(storage) } = fieldAccessors(field, type, options, counter);
                const { unpackTransform } = options;

                if (counter) {
                    this.#arrays.set(field, {
                        offset,
                        stride: type instanceof ArrayOf ? type.element.size : 1,
                        setLength: (view, count) => counter.set(view, offset + counter.relOffset, count),
                    });
                }

                return {
                    name: field,
                    type,
                    offset,
                    size: storage,
                    // A field that holds another's count is written by that field,
                    // the only place the count is known for certain; packing it
                    // from the object as well would let the two disagree.
                    pack: options.lengthOf === undefined
                        ? fieldPacker(field, offset, set, zero, options)
                        : () => {},
                    get: unpackTransform ? (view, off) => unpackTransform(get(view, off)) : get,
                };
            });
        }
        #pack(view, offset, obj) {
            for (const field of this.#layout) {
                field.pack(view, offset, obj);
            }
        }
        #unpackInto(view, offset, target) {
            for (const field of this.#layout) {
                target[field.name] = field.get(view, offset + field.offset);
            }

            return target;
        }
        // The struct bytes as a Uint8Array, which is what the call machinery
        // marshals a by-value struct argument from.
        pack(obj) {
            const bytes = new Uint8Array(this.size);

            this.#pack(new DataView(bytes.buffer), 0, obj);

            return bytes;
        }
        unpack(buf) {
            const view = toDataView(buf);

            checkRange(view, 0, this.size);

            return this.#unpackInto(view, 0, {});
        }
        // Unpack into an object the caller owns and reuses, one field assignment at
        // a time: the point is to read a run of structs without allocating a result
        // object per element.
        unpackInto(buf, target, offset = 0) {
            const view = toDataView(buf);

            checkRange(view, offset, this.size);

            return this.#unpackInto(view, offset, target);
        }
        unpackList(buf, count) {
            checkCount(count);

            const view = toDataView(buf);
            const size = this.size;

            checkRange(view, 0, size * count);

            const list = new Array(count);

            for (let i = 0; i < count; i++) {
                list[i] = this.#unpackInto(view, i * size, {});
            }

            return list;
        }
        // Pack a run of structs into a buffer the caller owns, without a buffer per
        // element. Only the fields are written: padding between them keeps whatever
        // the buffer already held, which C never reads but a byte comparison would
        // see.
        packListInto(objects, buf, offset = 0) {
            const view = toDataView(buf);
            const size = this.size;

            checkRange(view, offset, size * objects.length);

            for (let i = 0; i < objects.length; i++) {
                this.#pack(view, offset + i * size, objects[i]);
            }
        }
        toBuffer(data) {
            return this.pack(data);
        }
        fromBuffer(buf) {
            return this.unpack(buf);
        }
        get fields() {
            return this.#fields;
        }
        get align() {
            return this.ffiType.alignment;
        }
        describe() {
            return this.#layout.map(({ name, offset, size, type }) => {
                return { name, offset, size, type: typeName(type) };
            });
        }
    }

    return {
        defineStruct(fields) {
            return new StructDef(fields);
        },
        // C gives an enum whose enumerators fit in `int` that type, so that is the
        // default; a `enum : uint8_t` or a bitfield-width enum passes its own.
        defineEnum(members, type = types.sint) {
            return new EnumDef(members, type);
        },
        // Zeroed struct bytes plus a buffer per named array field, wired up as if
        // pack() had written an array of that many elements: hand the bytes to a C
        // function that fills the struct in, then unpack() them.
        allocStruct(def, options = {}) {
            if (!(def instanceof StructDef)) {
                throw new TypeError('allocStruct expects a defineStruct() type');
            }

            for (const key of Object.keys(options)) {
                if (key !== 'lengths') {
                    throw new TypeError(`allocStruct has no '${key}' option`);
                }
            }

            const bytes = new Uint8Array(def.size);
            const view = new DataView(bytes.buffer);
            const arrays = {};

            for (const [ field, count ] of Object.entries(options.lengths ?? {})) {
                const array = structArrays(def).get(field);

                if (!array) {
                    throw new TypeError(`allocStruct: '${field}' is not a field with a length field`);
                }

                checkCount(count);

                const elements = new Uint8Array(count * array.stride);

                // A run of no elements has no address worth taking, so the field
                // stays the null pointer the zeroed bytes already hold.
                if (count > 0) {
                    writeAddress(view, array.offset, bufferToPointer(elements).value);
                    retain(bytes.buffer, elements);
                }

                array.setLength(view, count);
                arrays[field] = elements;
            }

            return { bytes, arrays };
        },
    };
}
