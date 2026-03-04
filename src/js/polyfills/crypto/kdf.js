import { CryptoKey, kKeyData } from './crypto-key.js';
import { digestAlgorithms, nativePbkdf2, nativeHkdf, normalizeHashAlgorithm, toUint8Array } from './helpers.js';

const validKdfUsages = [ 'deriveBits', 'deriveKey' ];

export function kdfImportKey(format, keyData, algorithm, extractable, keyUsages) {
    if (format !== 'raw') {
        throw new DOMException(`Unsupported key format: ${format}`, 'NotSupportedError');
    }

    if (extractable) {
        throw new DOMException('KDF keys must not be extractable', 'SyntaxError');
    }

    for (const usage of keyUsages) {
        if (!validKdfUsages.includes(usage)) {
            throw new DOMException(`Invalid key usage: ${usage}`, 'SyntaxError');
        }
    }

    let rawBytes;

    if (ArrayBuffer.isView(keyData)) {
        rawBytes = new Uint8Array(keyData.buffer.slice(keyData.byteOffset, keyData.byteOffset + keyData.byteLength));
    } else if (keyData instanceof ArrayBuffer) {
        rawBytes = new Uint8Array(keyData.slice(0));
    } else {
        throw new TypeError('keyData must be a BufferSource');
    }

    const algoName = typeof algorithm === 'string' ? algorithm : algorithm?.name;

    return new CryptoKey('secret', false, { name: algoName }, keyUsages, rawBytes);
}

export function pbkdf2DeriveBits(algorithm, baseKey, length, requiredUsage = 'deriveBits') {
    if (!(baseKey instanceof CryptoKey)) {
        return Promise.reject(new TypeError('baseKey must be a CryptoKey'));
    }

    if (baseKey.algorithm.name !== 'PBKDF2') {
        return Promise.reject(new DOMException('Key algorithm mismatch', 'InvalidAccessError'));
    }

    if (!baseKey.usages.includes(requiredUsage)) {
        return Promise.reject(
            new DOMException(`Key does not support the "${requiredUsage}" operation`, 'InvalidAccessError'));
    }

    if (length === 0 || length % 8 !== 0) {
        return Promise.reject(new DOMException('length must be a non-zero multiple of 8', 'OperationError'));
    }

    let hashName, salt;

    try {
        hashName = normalizeHashAlgorithm(algorithm.hash);
        salt = toUint8Array(algorithm.salt);
    } catch (e) {
        return Promise.reject(e);
    }

    const iterations = algorithm.iterations;

    if (!iterations || iterations <= 0) {
        return Promise.reject(new DOMException('iterations must be positive', 'OperationError'));
    }

    const typeId = digestAlgorithms[hashName];
    const byteLength = length / 8;
    const { promise, resolve, reject } = Promise.withResolvers();

    nativePbkdf2(typeId, baseKey[kKeyData], salt, iterations, byteLength, (err, result) => {
        if (err) {
            reject(new DOMException(err, 'OperationError'));
        } else {
            resolve(result.buffer);
        }
    });

    return promise;
}

export function hkdfDeriveBits(algorithm, baseKey, length, requiredUsage = 'deriveBits') {
    if (!(baseKey instanceof CryptoKey)) {
        return Promise.reject(new TypeError('baseKey must be a CryptoKey'));
    }

    if (baseKey.algorithm.name !== 'HKDF') {
        return Promise.reject(new DOMException('Key algorithm mismatch', 'InvalidAccessError'));
    }

    if (!baseKey.usages.includes(requiredUsage)) {
        return Promise.reject(
            new DOMException(`Key does not support the "${requiredUsage}" operation`, 'InvalidAccessError'));
    }

    if (length === 0 || length % 8 !== 0) {
        return Promise.reject(new DOMException('length must be a non-zero multiple of 8', 'OperationError'));
    }

    let hashName, salt, info;

    try {
        hashName = normalizeHashAlgorithm(algorithm.hash);
        salt = toUint8Array(algorithm.salt);
        info = toUint8Array(algorithm.info);
    } catch (e) {
        return Promise.reject(e);
    }

    const typeId = digestAlgorithms[hashName];
    const byteLength = length / 8;
    const { promise, resolve, reject } = Promise.withResolvers();

    nativeHkdf(typeId, baseKey[kKeyData], salt, info, byteLength, (err, result) => {
        if (err) {
            reject(new DOMException(err, 'OperationError'));
        } else {
            resolve(result.buffer);
        }
    });

    return promise;
}
