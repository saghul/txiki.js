import { CryptoKey, kKeyData } from './crypto-key.js';
import {
    curveAlgorithms,
    curveIdToName,
    digestAlgorithms,
    nativeEcGenerateKey,
    nativeEcdsaSign,
    nativeEcdsaVerify,
    nativeEcdhDeriveBits,
    nativeEcParseKey,
    nativeEcKeyToDer,
    nativeEcGetPublicKey,
    normalizeCurve,
    normalizeHashAlgorithm,
    toUint8Array,
    base64urlEncode,
    base64urlDecode,
} from './helpers.js';

const curveByteSizes = { 'P-256': 32, 'P-384': 48, 'P-521': 66 };

const validEcdsaUsages = [ 'sign', 'verify' ];
const validEcdhUsages = [ 'deriveBits', 'deriveKey' ];

export function ecGenerateKey(algorithm, extractable, keyUsages) {
    const algoName = typeof algorithm === 'string' ? algorithm : algorithm?.name;
    const namedCurve = normalizeCurve(algorithm.namedCurve);
    const curveId = curveAlgorithms[namedCurve];
    const validUsages = algoName === 'ECDSA' ? validEcdsaUsages : validEcdhUsages;

    for (const usage of keyUsages) {
        if (!validUsages.includes(usage)) {
            return Promise.reject(new DOMException(`Invalid key usage: ${usage}`, 'SyntaxError'));
        }
    }

    const { promise, resolve, reject } = Promise.withResolvers();

    nativeEcGenerateKey(curveId, (err, privKeyBytes, pubKeyBytes) => {
        if (err) {
            reject(new DOMException(err, 'OperationError'));

            return;
        }

        const algo = { name: algoName, namedCurve };
        let privUsages, pubUsages;

        if (algoName === 'ECDSA') {
            privUsages = keyUsages.filter(u => u === 'sign');
            pubUsages = keyUsages.filter(u => u === 'verify');
        } else {
            privUsages = keyUsages.filter(u => validEcdhUsages.includes(u));
            pubUsages = [];
        }

        const privateKey = new CryptoKey('private', extractable, algo, privUsages, privKeyBytes);
        const publicKey = new CryptoKey('public', true, algo, pubUsages, pubKeyBytes);

        resolve({ publicKey, privateKey });
    });

    return promise;
}

export function ecdsaSign(algorithm, key, data) {
    if (!(key instanceof CryptoKey)) {
        return Promise.reject(new TypeError('key must be a CryptoKey'));
    }

    if (key.type !== 'private') {
        return Promise.reject(new DOMException('Key must be a private key', 'InvalidAccessError'));
    }

    if (key.algorithm.name !== 'ECDSA') {
        return Promise.reject(new DOMException('Key algorithm mismatch', 'InvalidAccessError'));
    }

    if (!key.usages.includes('sign')) {
        return Promise.reject(new DOMException('Key does not support the "sign" operation', 'InvalidAccessError'));
    }

    let hashName, bytes;

    try {
        hashName = normalizeHashAlgorithm(algorithm.hash);
        bytes = toUint8Array(data);
    } catch (e) {
        return Promise.reject(e);
    }

    const curveId = curveAlgorithms[key.algorithm.namedCurve];
    const hashTypeId = digestAlgorithms[hashName];
    const { promise, resolve, reject } = Promise.withResolvers();

    nativeEcdsaSign(curveId, hashTypeId, key[kKeyData], bytes, (err, result) => {
        if (err) {
            reject(new DOMException(err, 'OperationError'));
        } else {
            resolve(result.buffer);
        }
    });

    return promise;
}

export function ecdsaVerify(algorithm, key, signature, data) {
    if (!(key instanceof CryptoKey)) {
        return Promise.reject(new TypeError('key must be a CryptoKey'));
    }

    if (key.type !== 'public') {
        return Promise.reject(new DOMException('Key must be a public key', 'InvalidAccessError'));
    }

    if (key.algorithm.name !== 'ECDSA') {
        return Promise.reject(new DOMException('Key algorithm mismatch', 'InvalidAccessError'));
    }

    if (!key.usages.includes('verify')) {
        return Promise.reject(new DOMException('Key does not support the "verify" operation', 'InvalidAccessError'));
    }

    let hashName, sigBytes, dataBytes;

    try {
        hashName = normalizeHashAlgorithm(algorithm.hash);
        sigBytes = toUint8Array(signature);
        dataBytes = toUint8Array(data);
    } catch (e) {
        return Promise.reject(e);
    }

    const curveId = curveAlgorithms[key.algorithm.namedCurve];
    const hashTypeId = digestAlgorithms[hashName];
    const { promise, resolve, reject } = Promise.withResolvers();

    nativeEcdsaVerify(curveId, hashTypeId, key[kKeyData], sigBytes, dataBytes, (err, result) => {
        if (err) {
            reject(new DOMException(err, 'OperationError'));
        } else {
            resolve(result);
        }
    });

    return promise;
}

export function ecdhDeriveBits(algorithm, baseKey, length, requiredUsage = 'deriveBits') {
    if (!(baseKey instanceof CryptoKey)) {
        return Promise.reject(new TypeError('baseKey must be a CryptoKey'));
    }

    if (baseKey.type !== 'private') {
        return Promise.reject(new DOMException('Key must be a private key', 'InvalidAccessError'));
    }

    if (baseKey.algorithm.name !== 'ECDH') {
        return Promise.reject(new DOMException('Key algorithm mismatch', 'InvalidAccessError'));
    }

    if (!baseKey.usages.includes(requiredUsage)) {
        return Promise.reject(
            new DOMException(`Key does not support the "${requiredUsage}" operation`, 'InvalidAccessError'));
    }

    const pubKey = algorithm.public;

    if (!(pubKey instanceof CryptoKey)) {
        return Promise.reject(new TypeError('algorithm.public must be a CryptoKey'));
    }

    if (pubKey.algorithm.name !== 'ECDH') {
        return Promise.reject(new DOMException('Public key algorithm mismatch', 'InvalidAccessError'));
    }

    if (pubKey.algorithm.namedCurve !== baseKey.algorithm.namedCurve) {
        return Promise.reject(new DOMException('Curve mismatch between keys', 'InvalidAccessError'));
    }

    if (length === 0 || length % 8 !== 0) {
        return Promise.reject(new DOMException('length must be a non-zero multiple of 8', 'OperationError'));
    }

    const namedCurve = baseKey.algorithm.namedCurve;
    const maxBits = curveByteSizes[namedCurve] * 8;

    if (length > maxBits) {
        return Promise.reject(new DOMException(`length exceeds curve size (${maxBits} bits)`, 'OperationError'));
    }

    const curveId = curveAlgorithms[namedCurve];
    const { promise, resolve, reject } = Promise.withResolvers();

    nativeEcdhDeriveBits(curveId, baseKey[kKeyData], pubKey[kKeyData], (err, result) => {
        if (err) {
            reject(new DOMException(err, 'OperationError'));
        } else {
            const byteLength = length / 8;

            if (byteLength < result.byteLength) {
                resolve(result.buffer.slice(0, byteLength));
            } else {
                resolve(result.buffer);
            }
        }
    });

    return promise;
}

export function ecImportKey(format, keyData, algorithm, extractable, keyUsages) {
    const algoName = typeof algorithm === 'string' ? algorithm : algorithm?.name;
    const namedCurve = normalizeCurve(algorithm.namedCurve);

    if (format === 'jwk') {
        if (keyData.kty !== 'EC') {
            throw new DOMException(`Invalid JWK key type: ${keyData.kty}`, 'DataError');
        }

        if (keyData.crv !== namedCurve) {
            throw new DOMException(`JWK curve ${keyData.crv} does not match ${namedCurve}`, 'DataError');
        }

        const size = curveByteSizes[namedCurve];
        const x = base64urlDecode(keyData.x);
        const y = base64urlDecode(keyData.y);

        if (x.byteLength !== size || y.byteLength !== size) {
            throw new DOMException('Invalid EC JWK coordinate size', 'DataError');
        }

        if (keyData.d) {
            const d = base64urlDecode(keyData.d);
            const validUsages = algoName === 'ECDSA' ? [ 'sign' ] : [ 'deriveBits', 'deriveKey' ];

            for (const usage of keyUsages) {
                if (!validUsages.includes(usage)) {
                    throw new DOMException(`Invalid key usage for EC private key: ${usage}`, 'SyntaxError');
                }
            }

            return new CryptoKey('private', extractable, { name: algoName, namedCurve }, keyUsages, d);
        }

        const validUsages = algoName === 'ECDSA' ? [ 'verify' ] : [];

        for (const usage of keyUsages) {
            if (!validUsages.includes(usage)) {
                throw new DOMException(`Invalid key usage for EC public key: ${usage}`, 'SyntaxError');
            }
        }

        const pubBytes = new Uint8Array(1 + 2 * size);

        pubBytes[0] = 0x04;
        pubBytes.set(x, 1);
        pubBytes.set(y, 1 + size);

        return new CryptoKey('public', extractable, { name: algoName, namedCurve }, keyUsages, pubBytes);
    }

    let rawBytes;

    if (ArrayBuffer.isView(keyData)) {
        rawBytes = new Uint8Array(keyData.buffer.slice(keyData.byteOffset, keyData.byteOffset + keyData.byteLength));
    } else if (keyData instanceof ArrayBuffer) {
        rawBytes = new Uint8Array(keyData.slice(0));
    } else {
        throw new TypeError('keyData must be a BufferSource');
    }

    if (format === 'raw') {
        const expectedLen = 1 + 2 * curveByteSizes[namedCurve];
        const validUsages = algoName === 'ECDSA' ? [ 'verify' ] : [];

        for (const usage of keyUsages) {
            if (!validUsages.includes(usage)) {
                throw new DOMException(`Invalid key usage for raw public key: ${usage}`, 'SyntaxError');
            }
        }

        if (rawBytes.byteLength !== expectedLen) {
            throw new DOMException(
                `Invalid key data length: expected ${expectedLen} bytes, got ${rawBytes.byteLength}`, 'DataError');
        }

        if (rawBytes[0] !== 0x04) {
            throw new DOMException('Invalid uncompressed point format', 'DataError');
        }

        return new CryptoKey('public', extractable, { name: algoName, namedCurve }, keyUsages, rawBytes);
    }

    if (format === 'spki') {
        const validUsages = algoName === 'ECDSA' ? [ 'verify' ] : [];

        for (const usage of keyUsages) {
            if (!validUsages.includes(usage)) {
                throw new DOMException(`Invalid key usage for spki public key: ${usage}`, 'SyntaxError');
            }
        }

        const parsed = nativeEcParseKey(rawBytes, false);
        const parsedCurve = curveIdToName[parsed.curve];

        if (parsedCurve !== namedCurve) {
            throw new DOMException(`Key curve ${parsedCurve} does not match ${namedCurve}`, 'DataError');
        }

        return new CryptoKey('public', extractable, { name: algoName, namedCurve }, keyUsages, parsed.keyData);
    }

    if (format === 'pkcs8') {
        const validUsages = algoName === 'ECDSA' ? [ 'sign' ] : [ 'deriveBits', 'deriveKey' ];

        for (const usage of keyUsages) {
            if (!validUsages.includes(usage)) {
                throw new DOMException(`Invalid key usage for pkcs8 private key: ${usage}`, 'SyntaxError');
            }
        }

        const parsed = nativeEcParseKey(rawBytes, true);
        const parsedCurve = curveIdToName[parsed.curve];

        if (parsedCurve !== namedCurve) {
            throw new DOMException(`Key curve ${parsedCurve} does not match ${namedCurve}`, 'DataError');
        }

        return new CryptoKey('private', extractable, { name: algoName, namedCurve }, keyUsages, parsed.keyData);
    }

    throw new DOMException(`Unsupported key format: ${format}`, 'NotSupportedError');
}

export function ecExportKey(format, key) {
    if (!key.extractable) {
        throw new DOMException('Key is not extractable', 'InvalidAccessError');
    }

    if (format === 'raw') {
        if (key.type === 'private') {
            throw new DOMException('Cannot export private key in raw format', 'InvalidAccessError');
        }

        return key[kKeyData].buffer.slice(0);
    }

    if (format === 'spki') {
        if (key.type !== 'public') {
            throw new DOMException('Cannot export private key as spki', 'InvalidAccessError');
        }

        const curveId = curveAlgorithms[key.algorithm.namedCurve];
        const der = nativeEcKeyToDer(key[kKeyData], curveId, false);

        return der.buffer.slice(der.byteOffset, der.byteOffset + der.byteLength);
    }

    if (format === 'pkcs8') {
        if (key.type !== 'private') {
            throw new DOMException('Cannot export public key as pkcs8', 'InvalidAccessError');
        }

        const curveId = curveAlgorithms[key.algorithm.namedCurve];
        const der = nativeEcKeyToDer(key[kKeyData], curveId, true);

        return der.buffer.slice(der.byteOffset, der.byteOffset + der.byteLength);
    }

    if (format === 'jwk') {
        const namedCurve = key.algorithm.namedCurve;
        const size = curveByteSizes[namedCurve];
        const curveId = curveAlgorithms[namedCurve];
        let pubBytes;

        if (key.type === 'private') {
            pubBytes = nativeEcGetPublicKey(key[kKeyData], curveId);
        } else {
            pubBytes = key[kKeyData];
        }

        const x = base64urlEncode(pubBytes.slice(1, 1 + size));
        const y = base64urlEncode(pubBytes.slice(1 + size));

        const jwk = {
            kty: 'EC',
            crv: namedCurve,
            x,
            y,
            ext: key.extractable,
            key_ops: [ ...key.usages ],
        };

        if (key.type === 'private') {
            jwk.d = base64urlEncode(key[kKeyData]);
        }

        return jwk;
    }

    throw new DOMException(`Unsupported export format: ${format}`, 'NotSupportedError');
}
