import core from 'tjs:internal/core';

// Immutable buffers include those pinned by an in-flight native write;
// detaching one would free memory the write still reads.
function checkTransferable(t) {
    if (core.isImmutableArrayBuffer(t)) {
        throw new DOMException('Cannot transfer an immutable ArrayBuffer', 'DataCloneError');
    }
}

function cloneError(msg) {
    return new DOMException(msg, 'DataCloneError');
}

// Intrinsic accessors, captured up front so user code cannot swap them out.
// They also double as brand checks: they throw on the wrong receiver.
const uncurry = fn => Function.prototype.call.bind(fn);
const getter = (proto, key) => uncurry(Object.getOwnPropertyDescriptor(proto, key).get);

const TypedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedArrayTag = getter(TypedArrayPrototype, Symbol.toStringTag);
const typedArrayBuffer = getter(TypedArrayPrototype, 'buffer');
const typedArrayByteOffset = getter(TypedArrayPrototype, 'byteOffset');
const typedArrayLength = getter(TypedArrayPrototype, 'length');
const dataViewBuffer = getter(DataView.prototype, 'buffer');
const dataViewByteOffset = getter(DataView.prototype, 'byteOffset');
const dataViewByteLength = getter(DataView.prototype, 'byteLength');
const arrayBufferByteLength = getter(ArrayBuffer.prototype, 'byteLength');
const arrayBufferDetached = getter(ArrayBuffer.prototype, 'detached');
const arrayBufferResizable = getter(ArrayBuffer.prototype, 'resizable');
const arrayBufferMaxByteLength = getter(ArrayBuffer.prototype, 'maxByteLength');
const sharedArrayBufferByteLength = getter(SharedArrayBuffer.prototype, 'byteLength');
const regExpSource = getter(RegExp.prototype, 'source');
const regExpFlags = getter(RegExp.prototype, 'flags');
const mapEntries = uncurry(Map.prototype.entries);
const setValues = uncurry(Set.prototype.values);
const dateGetTime = uncurry(Date.prototype.getTime);
const booleanValueOf = uncurry(Boolean.prototype.valueOf);
const numberValueOf = uncurry(Number.prototype.valueOf);
const stringValueOf = uncurry(String.prototype.valueOf);
const bigIntValueOf = uncurry(BigInt.prototype.valueOf);
const symbolValueOf = uncurry(Symbol.prototype.valueOf);
const objectToString = uncurry(Object.prototype.toString);
const hasOwn = Object.hasOwn;

const brandChecks = [
    uncurry(WeakMap.prototype.has),
    uncurry(WeakSet.prototype.has),
    uncurry(WeakRef.prototype.deref),
    uncurry(FinalizationRegistry.prototype.unregister),
];

const errorConstructors = {
    Error,
    EvalError,
    RangeError,
    ReferenceError,
    SyntaxError,
    TypeError,
    URIError,
};

function is(check, value) {
    try {
        check(value);

        return true;
    } catch {
        return false;
    }
}

function defineValue(obj, key, value) {
    Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
}

function cloneArrayBuffer(buf) {
    if (arrayBufferDetached(buf)) {
        throw cloneError('An ArrayBuffer is detached and could not be cloned.');
    }

    const len = arrayBufferByteLength(buf);
    const copy = arrayBufferResizable(buf)
        ? new ArrayBuffer(len, { maxByteLength: arrayBufferMaxByteLength(buf) })
        : new ArrayBuffer(len);

    new Uint8Array(copy).set(new Uint8Array(buf, 0, len));

    return copy;
}

// Implements StructuredSerializeInternal + StructuredDeserialize in a single pass:
// https://html.spec.whatwg.org/multipage/structured-data.html#structuredserializeinternal
function clone(value, memory) {
    const type = typeof value;

    if (type === 'symbol') {
        throw cloneError(`${String(value)} could not be cloned.`);
    }

    if (type !== 'object' && type !== 'function' || value === null) {
        return value;
    }

    if (memory.has(value)) {
        return memory.get(value);
    }

    if (type === 'function') {
        throw cloneError('A function could not be cloned.');
    }

    let out;

    // Primitive wrappers, Date and RegExp.
    if (is(booleanValueOf, value)) {
        out = Object(booleanValueOf(value));
    } else if (is(numberValueOf, value)) {
        out = Object(numberValueOf(value));
    } else if (is(stringValueOf, value)) {
        out = Object(stringValueOf(value));
    } else if (is(bigIntValueOf, value)) {
        out = Object(bigIntValueOf(value));
    } else if (is(symbolValueOf, value)) {
        throw cloneError('A Symbol object could not be cloned.');
    } else if (is(dateGetTime, value)) {
        out = new Date(dateGetTime(value));
    } else if (value !== RegExp.prototype && is(regExpSource, value)) {
        out = new RegExp(regExpSource(value), regExpFlags(value));
    }

    if (out !== undefined) {
        memory.set(value, out);

        return out;
    }

    // Buffers and views. A SharedArrayBuffer clone is a new object backed by
    // the same memory, which QuickJS's serializer already does.
    if (is(sharedArrayBufferByteLength, value)) {
        out = core.deserialize(core.serialize(value));
        memory.set(value, out);

        return out;
    }

    if (is(arrayBufferByteLength, value)) {
        out = cloneArrayBuffer(value);
        memory.set(value, out);

        return out;
    }

    const typedArrayName = typedArrayTag(value);

    if (typedArrayName !== undefined) {
        const buffer = clone(typedArrayBuffer(value), memory);

        out = new globalThis[typedArrayName](buffer, typedArrayByteOffset(value), typedArrayLength(value));
        memory.set(value, out);

        return out;
    }

    if (is(dataViewBuffer, value)) {
        const buffer = clone(dataViewBuffer(value), memory);

        out = new DataView(buffer, dataViewByteOffset(value), dataViewByteLength(value));
        memory.set(value, out);

        return out;
    }

    // Blob and File: the clone shares the (immutable) data.
    const { Blob, File } = globalThis;

    if (typeof File === 'function' && value instanceof File) {
        out = new File([ value ], value.name, { type: value.type, lastModified: value.lastModified });
        memory.set(value, out);

        return out;
    }

    if (typeof Blob === 'function' && value instanceof Blob) {
        out = new Blob([ value ], { type: value.type });
        memory.set(value, out);

        return out;
    }

    if (brandChecks.some(check => is(check, value)) || value instanceof Promise) {
        throw cloneError(`${objectToString(value)} could not be cloned.`);
    }

    // Map and Set: snapshot the entries before cloning, so user code that runs
    // while cloning them (getters) cannot change what gets copied.
    if (is(mapEntries, value)) {
        const entries = [ ...mapEntries(value) ];

        out = new Map();
        memory.set(value, out);

        for (const [ k, v ] of entries) {
            out.set(clone(k, memory), clone(v, memory));
        }

        return out;
    }

    if (is(setValues, value)) {
        const values = [ ...setValues(value) ];

        out = new Set();
        memory.set(value, out);

        for (const v of values) {
            out.add(clone(v, memory));
        }

        return out;
    }

    if (objectToString(value) === '[object Error]') {
        let name = value.name;

        if (!hasOwn(errorConstructors, name)) {
            name = 'Error';
        }

        const messageDesc = Object.getOwnPropertyDescriptor(value, 'message');
        const message = messageDesc && 'value' in messageDesc ? String(messageDesc.value) : undefined;

        out = message === undefined ? new errorConstructors[name]() : new errorConstructors[name](message);

        // Not required by the spec, but other runtimes keep the original stack.
        const stack = value.stack;

        if (typeof stack === 'string') {
            Object.defineProperty(out, 'stack', { value: stack, writable: true, configurable: true });
        }

        memory.set(value, out);

        return out;
    }

    // Arrays keep their length (and therefore their holes) and any extra own
    // properties; everything else becomes a plain object. Getters are invoked.
    if (Array.isArray(value)) {
        out = new Array(Object.getOwnPropertyDescriptor(value, 'length').value);
    } else {
        out = {};
    }

    memory.set(value, out);

    for (const key of Object.keys(value)) {
        if (hasOwn(value, key)) {
            defineValue(out, key, clone(value[key], memory));
        }
    }

    return out;
}

globalThis.structuredClone = (value, options = {}) => {
    // Snapshot the list so no user code (iterators, accessors) runs between
    // the final check and the detach below.
    const transfers = [ ...(options?.transfer ?? []) ];

    for (let i = 0; i < transfers.length; i++) {
        if (!core.isArrayBuffer(transfers[i])) {
            throw new DOMException('Transferrable is not an ArrayBuffer', 'DataCloneError');
        }

        checkTransferable(transfers[i]);
    }

    const ret = clone(value, new Map());

    // Cloning can run user code (getters) that pins a buffer, so check
    // again before detaching anything: either all transfers detach or none.
    for (let i = 0; i < transfers.length; i++) {
        checkTransferable(transfers[i]);
    }

    for (let i = 0; i < transfers.length; i++) {
        core.detachArrayBuffer(transfers[i]);
    }

    return ret;
};
