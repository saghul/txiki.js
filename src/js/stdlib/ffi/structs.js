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
    { AdvancedType, StructType, types, resolveType, createPointer, bufferToPointer, isPointer }) {
    const encoder = new TextEncoder();
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

    // A nested struct is copied into the outer buffer by value, so the addresses
    // its pack wrote now live in the outer bytes while the buffers behind them
    // are retained by the nested buffer. Keeping that buffer alive on the outer
    // one keeps its WeakMap entry, and everything it retains, alive too.
    function retainNested(owner, nested) {
        if (retainedTargets.has(nested)) {
            retain(owner, nested);
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

    function nestedAccessors(def) {
        return {
            get: (v, o) => def.unpack(new Uint8Array(v.buffer, v.byteOffset + o, def.size)),
            set: (v, o, obj) => {
                const bytes = def.pack(obj);

                new Uint8Array(v.buffer, v.byteOffset, v.byteLength).set(bytes, o);
                retainNested(v.buffer, bytes.buffer);
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

        if (type instanceof StructDef) {
            return nestedAccessors(type);
        }

        throw new TypeError(`struct field '${name}' has an unsupported type: ${type.name}`);
    }

    const fieldOptions = new Set([
        'condition', 'default', 'optional', 'packTransform', 'unpackTransform', 'validate',
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
    }

    // The pack side of a field, resolved once here instead of by looking at the
    // options on every pack: a field that uses none of them ends up with the same
    // single write it had before options existed.
    function fieldPacker(name, offset, size, set, options) {
        const { packTransform, validate } = options;
        let write = packTransform
            ? (view, value) => set(view, offset, packTransform(value))
            : (view, value) => set(view, offset, value);

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
            write = (view, value, obj) => {
                for (const fn of validators) {
                    fn(value, name, { input: obj });
                }

                packValue(view, value);
            };
        }

        const fallback = options.default;

        // `default` beats `optional`: with both, an absent field packs the default
        // and `optional` only says that its absence is not an error. Only
        // `undefined` counts as absent — null is a value a pointer or a cstring
        // field takes, so it is packed rather than replaced.
        if (fallback !== undefined) {
            return (view, obj) => {
                const value = obj[name];

                write(view, value === undefined ? fallback : value, obj);
            };
        }

        if (options.optional) {
            return (view, obj) => {
                const value = obj[name];

                if (value === undefined) {
                    // Zero bytes, which is what unpack then reads back as: a 0, a
                    // false, or a null for a pointer or a cstring.
                    new Uint8Array(view.buffer, view.byteOffset + offset, size).fill(0);

                    return;
                }

                write(view, value, obj);
            };
        }

        return (view, obj) => {
            const value = obj[name];

            if (value === undefined) {
                throw new TypeError(`missing value for struct field '${name}'`);
            }

            write(view, value, obj);
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

    // A struct is an AdvancedType so that it can be handed to dlopen() as an
    // argument or return type: toBuffer/fromBuffer are pack/unpack.
    class StructDef extends AdvancedType {
        #fields;
        #layout;

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

                resolved.push([ field, resolveType(type), options ]);
            }

            if (resolved.length === 0) {
                throw new TypeError('every field of the struct was excluded by its condition');
            }

            const name = `struct(${resolved.map(([ field ]) => field).join(', ')})`;
            // libffi is the layout authority: the offsets, the size and the
            // alignment of the struct all come from the ffi_type it prepares. An
            // enum field is laid out as the integer it is stored in.
            const structType = new StructType(
                resolved.map(([ field, type ]) => [ field, type instanceof EnumDef ? type.type : type ]), name);
            const offsets = structType.ffiType.offsets;

            super(structType.ffiType, { name });

            this.#fields = resolved.map(([ field, type ]) => [ field, type ]);
            this.#layout = resolved.map(([ field, type, options ], i) => {
                const { get, set } = accessorsFor(field, type);
                const { unpackTransform } = options;

                return {
                    name: field,
                    type,
                    offset: offsets[i],
                    size: type.size,
                    pack: fieldPacker(field, offsets[i], type.size, set, options),
                    get: unpackTransform ? (view, off) => unpackTransform(get(view, off)) : get,
                };
            });
        }
        // The struct bytes as a Uint8Array, which is what the call machinery
        // marshals a by-value struct argument from.
        pack(obj) {
            const bytes = new Uint8Array(this.size);
            const view = new DataView(bytes.buffer);

            for (const field of this.#layout) {
                field.pack(view, obj);
            }

            return bytes;
        }
        unpack(buf) {
            const view = toDataView(buf);

            if (view.byteLength < this.size) {
                throw new RangeError(`expected at least ${this.size} bytes, got ${view.byteLength}`);
            }

            const obj = {};

            for (const field of this.#layout) {
                obj[field.name] = field.get(view, field.offset);
            }

            return obj;
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
                return { name, offset, size, type: type.name };
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
    };
}
