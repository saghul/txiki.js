// Declarative struct packing: defineStruct([ [ name, type ], ... ]) hands back a
// type that turns plain JS objects into struct bytes and back.
//
// Ported from bun-ffi-structs v0.3.1 (https://github.com/anomalyco/bun-ffi-structs),
// MIT licensed, Copyright 2025 Anomaly. The declarative surface (pack / unpack /
// describe over a list of fields) and the pointer-target retention model come
// from there. The layout does not: libffi computes the offsets, the size and the
// alignment here, instead of a JS loop assuming `align == size` on a
// little-endian machine.

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

    for (const type of [ types.uint8, types.uint16, types.uint32, types.uint64,
        types.uchar, types.ushort, types.uint, types.ulong, types.ullong, types.size ]) {
        scalarAccessors.set(type, intAccessors(type, false));
    }

    for (const type of [ types.sint8, types.sint16, types.sint32, types.sint64,
        types.schar, types.sshort, types.sint, types.slong, types.sllong, types.ssize ]) {
        scalarAccessors.set(type, intAccessors(type, true));
    }

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

    function accessorsFor(name, type) {
        const scalar = scalarAccessors.get(type);

        if (scalar) {
            return scalar;
        }

        if (type === types.string) {
            return cstringAccessors;
        }

        if (type instanceof StructDef) {
            return nestedAccessors(type);
        }

        throw new TypeError(`struct field '${name}' has an unsupported type: ${type.name}`);
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

            const resolved = fields.map(([ name, type ]) => [ name, resolveType(type) ]);
            const name = `struct(${resolved.map(([ field ]) => field).join(', ')})`;
            // libffi is the layout authority: the offsets, the size and the
            // alignment of the struct all come from the ffi_type it prepares.
            const structType = new StructType(resolved, name);
            const offsets = structType.ffiType.offsets;

            super(structType.ffiType, { name });

            this.#fields = resolved;
            this.#layout = resolved.map(([ field, type ], i) => {
                return {
                    name: field,
                    type,
                    offset: offsets[i],
                    size: type.size,
                    ...accessorsFor(field, type),
                };
            });
        }
        // The struct bytes as a Uint8Array, which is what the call machinery
        // marshals a by-value struct argument from.
        pack(obj) {
            const bytes = new Uint8Array(this.size);
            const view = new DataView(bytes.buffer);

            for (const field of this.#layout) {
                const value = obj[field.name];

                if (value === undefined) {
                    throw new TypeError(`missing value for struct field '${field.name}'`);
                }

                field.set(view, field.offset, value);
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

    return function defineStruct(fields) {
        return new StructDef(fields);
    };
}
