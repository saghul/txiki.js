const core = globalThis[Symbol.for('tjs.internal.core')];

export const nativeDigest = core.webcrypto.digest;
export const nativeHmacSign = core.webcrypto.hmacSign;
export const nativeCipher = core.webcrypto.cipher;

export const digestAlgorithms = {
    'SHA-1':   nativeDigest.DIGEST_SHA1,
    'SHA-256': nativeDigest.DIGEST_SHA256,
    'SHA-384': nativeDigest.DIGEST_SHA384,
    'SHA-512': nativeDigest.DIGEST_SHA512,
};

export const hashBlockSizes = {
    'SHA-1':   64,
    'SHA-256': 64,
    'SHA-384': 128,
    'SHA-512': 128,
};

export function toUint8Array(data) {
    if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
    }

    throw new TypeError('data must be a BufferSource');
}

export function normalizeHashAlgorithm(hash) {
    const name = typeof hash === 'string' ? hash : hash?.name;

    if (!name || !(name in digestAlgorithms)) {
        throw new DOMException(`Unrecognized hash algorithm: ${name}`, 'NotSupportedError');
    }

    return name;
}
