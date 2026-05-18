import core from 'tjs:internal/core';

import { SubtleCrypto } from './subtle.js';


const TypedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const TypedArrayProto_toStringTag = Object.getOwnPropertyDescriptor(TypedArrayPrototype, Symbol.toStringTag).get;

function getRandomValues(obj) {
    const type = TypedArrayProto_toStringTag.call(obj);

    switch (type) {
        case 'Int8Array':
        case 'Uint8Array':
        case 'Uint8ClampedArray':
        case 'Int16Array':
        case 'Uint16Array':
        case 'Int32Array':
        case 'Uint32Array':
        case 'BigInt64Array':
        case 'BigUint64Array':
            break;
        default:
            throw new TypeError('Argument 1 of Crypto.getRandomValues does not implement interface ArrayBufferView');
    }

    if (obj.byteLength > 65536) {
        throw new DOMException('The requested length exceeds 65536 bytes', 'QuotaExceededError');
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
