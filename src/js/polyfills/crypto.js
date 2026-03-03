const core = globalThis[Symbol.for('tjs.internal.core')];

const TypedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const TypedArrayProto_toStringTag = Object.getOwnPropertyDescriptor(TypedArrayPrototype, Symbol.toStringTag).get;

const nativeDigest = core.webcrypto.digest;

const digestAlgorithms = {
    'SHA-1':   nativeDigest.DIGEST_SHA1,
    'SHA-256': nativeDigest.DIGEST_SHA256,
    'SHA-384': nativeDigest.DIGEST_SHA384,
    'SHA-512': nativeDigest.DIGEST_SHA512,
};


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

class SubtleCrypto {
    digest(algorithm, data) {
        const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;
        const typeId = digestAlgorithms[name];

        if (typeId === undefined) {
            return Promise.reject(new DOMException(`Unrecognized algorithm name: ${name}`, 'NotSupportedError'));
        }

        let bytes;

        if (ArrayBuffer.isView(data)) {
            bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        } else if (data instanceof ArrayBuffer) {
            bytes = new Uint8Array(data);
        } else {
            return Promise.reject(new TypeError('data must be a BufferSource'));
        }

        const { promise, resolve, reject } = Promise.withResolvers();

        nativeDigest(typeId, bytes, (err, result) => {
            if (err) {
                reject(new DOMException(err, 'OperationError'));
            } else {
                resolve(result.buffer);
            }
        });

        return promise;
    }
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
