import { CryptoKey, kKeyData } from './crypto-key.js';
import {
    digestAlgorithms, nativeHmacSign, normalizeHashAlgorithm,
    hashBlockSizes, toUint8Array, base64urlEncode, base64urlDecode,
} from './helpers.js';

function hmacCompute(hashName, keyData, data) {
    const typeId = digestAlgorithms[hashName];
    const { promise, resolve, reject } = Promise.withResolvers();

    nativeHmacSign(typeId, keyData, data, (err, result) => {
        if (err) {
            reject(new DOMException(err, 'OperationError'));
        } else {
            resolve(result);
        }
    });

    return promise;
}

export function hmacSign(algorithm, key, data) {
    if (!(key instanceof CryptoKey)) {
        return Promise.reject(new TypeError('key must be a CryptoKey'));
    }

    if (!key.usages.includes('sign')) {
        return Promise.reject(new DOMException('Key does not support the "sign" operation', 'InvalidAccessError'));
    }

    const hashName = normalizeHashAlgorithm(key.algorithm.hash);
    let bytes;

    try {
        bytes = toUint8Array(data);
    } catch (e) {
        return Promise.reject(e);
    }

    return hmacCompute(hashName, key[kKeyData], bytes).then(result => result.buffer);
}

export function hmacVerify(algorithm, key, signature, data) {
    if (!(key instanceof CryptoKey)) {
        return Promise.reject(new TypeError('key must be a CryptoKey'));
    }

    if (!key.usages.includes('verify')) {
        return Promise.reject(new DOMException('Key does not support the "verify" operation', 'InvalidAccessError'));
    }

    const hashName = normalizeHashAlgorithm(key.algorithm.hash);
    let sigBytes, dataBytes;

    try {
        sigBytes = toUint8Array(signature);
        dataBytes = toUint8Array(data);
    } catch (e) {
        return Promise.reject(e);
    }

    return hmacCompute(hashName, key[kKeyData], dataBytes).then(result => {
        const computed = new Uint8Array(result.buffer);

        if (computed.byteLength !== sigBytes.byteLength) {
            return false;
        }

        // Constant-time comparison.
        let diff = 0;

        for (let i = 0; i < computed.byteLength; i++) {
            diff |= computed[i] ^ sigBytes[i];
        }

        return diff === 0;
    });
}

export function hmacGenerateKey(algorithm, extractable, keyUsages) {
    const hashName = normalizeHashAlgorithm(algorithm.hash);
    const validUsages = [ 'sign', 'verify' ];

    for (const usage of keyUsages) {
        if (!validUsages.includes(usage)) {
            throw new DOMException(`Invalid key usage: ${usage}`, 'SyntaxError');
        }
    }

    const length = algorithm.length || (hashBlockSizes[hashName] * 8);
    const byteLength = length / 8;
    const keyData = new Uint8Array(byteLength);

    crypto.getRandomValues(keyData);

    return new CryptoKey('secret', extractable, { name: 'HMAC', hash: { name: hashName }, length }, keyUsages, keyData);
}

const hmacJwkAlg = { 'SHA-1': 'HS1', 'SHA-256': 'HS256', 'SHA-384': 'HS384', 'SHA-512': 'HS512' };

export function hmacImportKey(format, keyData, algorithm, extractable, keyUsages) {
    if (format !== 'raw' && format !== 'jwk') {
        throw new DOMException(`Unsupported key format: ${format}`, 'NotSupportedError');
    }

    const hashName = normalizeHashAlgorithm(algorithm.hash);
    const validUsages = [ 'sign', 'verify' ];

    for (const usage of keyUsages) {
        if (!validUsages.includes(usage)) {
            throw new DOMException(`Invalid key usage: ${usage}`, 'SyntaxError');
        }
    }

    let rawBytes;

    if (format === 'jwk') {
        if (keyData.kty !== 'oct') {
            throw new DOMException(`Invalid JWK key type: ${keyData.kty}`, 'DataError');
        }

        if (!keyData.k) {
            throw new DOMException('JWK missing "k" field', 'DataError');
        }

        rawBytes = base64urlDecode(keyData.k);
    } else {
        if (ArrayBuffer.isView(keyData)) {
            rawBytes = new Uint8Array(
                keyData.buffer.slice(keyData.byteOffset, keyData.byteOffset + keyData.byteLength));
        } else if (keyData instanceof ArrayBuffer) {
            rawBytes = new Uint8Array(keyData.slice(0));
        } else {
            throw new TypeError('keyData must be a BufferSource');
        }
    }

    if (rawBytes.byteLength === 0) {
        throw new DOMException('Key data must not be empty', 'DataError');
    }

    const length = algorithm.length || (rawBytes.byteLength * 8);

    const algo = { name: 'HMAC', hash: { name: hashName }, length };

    return new CryptoKey('secret', extractable, algo, keyUsages, rawBytes);
}

export function hmacExportKey(format, key) {
    if (format !== 'raw' && format !== 'jwk') {
        throw new DOMException(`Unsupported export format: ${format}`, 'NotSupportedError');
    }

    if (!key.extractable) {
        throw new DOMException('Key is not extractable', 'InvalidAccessError');
    }

    if (format === 'jwk') {
        return {
            kty: 'oct',
            k: base64urlEncode(key[kKeyData]),
            alg: hmacJwkAlg[key.algorithm.hash.name],
            ext: key.extractable,
            key_ops: [ ...key.usages ],
        };
    }

    return key[kKeyData].buffer.slice(0);
}
