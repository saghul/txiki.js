import { SubtleCrypto } from './subtle.js';

const core = globalThis[Symbol.for('tjs.internal.core')];

const TypedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const TypedArrayProto_toStringTag = Object.getOwnPropertyDescriptor(TypedArrayPrototype, Symbol.toStringTag).get;

function getRandomValues(obj) {
    const type = TypedArrayProto_toStringTag.call(obj);

    switch (type) {
        case 'Int8Array':
        case 'Uint8Array':
        case 'Int16Array':
        case 'Uint16Array':
        case 'Int32Array':
        case 'Uint32Array':
            break;
        default:
            throw new TypeError('Argument 1 of Crypto.getRandomValues does not implement interface ArrayBufferView');
    }

    if (obj.byteLength > 65536) {
        const e = new Error();

        e.name = 'QuotaExceededError';
        throw e;
    }

    core.random(obj.buffer, obj.byteOffset, obj.byteLength);

    return obj;
}

function randomUUID() {
    return core.randomUUID();
}

const subtle = new SubtleCrypto();

const crypto = Object.freeze({
    getRandomValues,
    randomUUID,
    subtle,
});

Object.defineProperty(window, 'crypto', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: crypto
});
