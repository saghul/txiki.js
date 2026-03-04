import { CryptoKey, kKeyData } from './crypto-key.js';
import {
    digestAlgorithms,
    nativeRsaGenerateKey,
    nativeRsaOaepEncrypt,
    nativeRsaOaepDecrypt,
    nativeRsaSign,
    nativeRsaVerify,
    nativeRsaParseKey,
    normalizeHashAlgorithm,
    toUint8Array,
} from './helpers.js';

const validOaepUsages = [ 'encrypt', 'decrypt', 'wrapKey', 'unwrapKey' ];
const validSignUsages = [ 'sign', 'verify' ];

export function rsaGenerateKey(algorithm, extractable, keyUsages) {
    const algoName = typeof algorithm === 'string' ? algorithm : algorithm?.name;
    const modulusLength = algorithm.modulusLength;
    const publicExponent = algorithm.publicExponent;
    const hashName = normalizeHashAlgorithm(algorithm.hash);
    const validUsages = algoName === 'RSA-OAEP' ? validOaepUsages : validSignUsages;

    for (const usage of keyUsages) {
        if (!validUsages.includes(usage)) {
            return Promise.reject(new DOMException(`Invalid key usage: ${usage}`, 'SyntaxError'));
        }
    }

    const pubExpBytes = toUint8Array(publicExponent);
    const { promise, resolve, reject } = Promise.withResolvers();

    nativeRsaGenerateKey(modulusLength, pubExpBytes, (err, privDER, pubDER) => {
        if (err) {
            reject(new DOMException(err, 'OperationError'));

            return;
        }

        const algo = {
            name: algoName, modulusLength,
            publicExponent: new Uint8Array(pubExpBytes),
            hash: { name: hashName },
        };
        let privUsages, pubUsages;

        if (algoName === 'RSA-OAEP') {
            privUsages = keyUsages.filter(u => u === 'decrypt' || u === 'unwrapKey');
            pubUsages = keyUsages.filter(u => u === 'encrypt' || u === 'wrapKey');
        } else {
            privUsages = keyUsages.filter(u => u === 'sign');
            pubUsages = keyUsages.filter(u => u === 'verify');
        }

        const privateKey = new CryptoKey('private', extractable, algo, privUsages, privDER);
        const publicKey = new CryptoKey('public', true, algo, pubUsages, pubDER);

        resolve({ publicKey, privateKey });
    });

    return promise;
}

export function rsaOaepEncrypt(algorithm, key, data) {
    if (!(key instanceof CryptoKey)) {
        return Promise.reject(new TypeError('key must be a CryptoKey'));
    }

    if (key.type !== 'public') {
        return Promise.reject(new DOMException('Key must be a public key', 'InvalidAccessError'));
    }

    if (key.algorithm.name !== 'RSA-OAEP') {
        return Promise.reject(new DOMException('Key algorithm mismatch', 'InvalidAccessError'));
    }

    if (!key.usages.includes('encrypt')) {
        return Promise.reject(new DOMException('Key does not support the "encrypt" operation', 'InvalidAccessError'));
    }

    let bytes, labelBytes;

    try {
        bytes = toUint8Array(data);
        labelBytes = algorithm.label ? toUint8Array(algorithm.label) : undefined;
    } catch (e) {
        return Promise.reject(e);
    }

    const hashName = key.algorithm.hash.name;
    const hashTypeId = digestAlgorithms[hashName];
    const { promise, resolve, reject } = Promise.withResolvers();

    nativeRsaOaepEncrypt(hashTypeId, key[kKeyData], bytes, labelBytes, (err, result) => {
        if (err) {
            reject(new DOMException(err, 'OperationError'));
        } else {
            resolve(result.buffer);
        }
    });

    return promise;
}

export function rsaOaepDecrypt(algorithm, key, data) {
    if (!(key instanceof CryptoKey)) {
        return Promise.reject(new TypeError('key must be a CryptoKey'));
    }

    if (key.type !== 'private') {
        return Promise.reject(new DOMException('Key must be a private key', 'InvalidAccessError'));
    }

    if (key.algorithm.name !== 'RSA-OAEP') {
        return Promise.reject(new DOMException('Key algorithm mismatch', 'InvalidAccessError'));
    }

    if (!key.usages.includes('decrypt')) {
        return Promise.reject(new DOMException('Key does not support the "decrypt" operation', 'InvalidAccessError'));
    }

    let bytes, labelBytes;

    try {
        bytes = toUint8Array(data);
        labelBytes = algorithm.label ? toUint8Array(algorithm.label) : undefined;
    } catch (e) {
        return Promise.reject(e);
    }

    const hashName = key.algorithm.hash.name;
    const hashTypeId = digestAlgorithms[hashName];
    const { promise, resolve, reject } = Promise.withResolvers();

    nativeRsaOaepDecrypt(hashTypeId, key[kKeyData], bytes, labelBytes, (err, result) => {
        if (err) {
            reject(new DOMException(err, 'OperationError'));
        } else {
            resolve(result.buffer);
        }
    });

    return promise;
}

export function rsaSign(algorithm, key, data) {
    if (!(key instanceof CryptoKey)) {
        return Promise.reject(new TypeError('key must be a CryptoKey'));
    }

    if (key.type !== 'private') {
        return Promise.reject(new DOMException('Key must be a private key', 'InvalidAccessError'));
    }

    const algoName = typeof algorithm === 'string' ? algorithm : algorithm?.name;

    if (key.algorithm.name !== algoName) {
        return Promise.reject(new DOMException('Key algorithm mismatch', 'InvalidAccessError'));
    }

    if (!key.usages.includes('sign')) {
        return Promise.reject(new DOMException('Key does not support the "sign" operation', 'InvalidAccessError'));
    }

    let bytes;

    try {
        bytes = toUint8Array(data);
    } catch (e) {
        return Promise.reject(e);
    }

    const paddingMode = algoName === 'RSA-PSS'
        ? nativeRsaSign.RSA_PADDING_PSS
        : nativeRsaSign.RSA_PADDING_PKCS1V15;
    const hashName = key.algorithm.hash.name;
    const hashTypeId = digestAlgorithms[hashName];
    const saltLength = algoName === 'RSA-PSS' ? algorithm.saltLength : 0;
    const { promise, resolve, reject } = Promise.withResolvers();

    nativeRsaSign(paddingMode, hashTypeId, saltLength, key[kKeyData], bytes, (err, result) => {
        if (err) {
            reject(new DOMException(err, 'OperationError'));
        } else {
            resolve(result.buffer);
        }
    });

    return promise;
}

export function rsaVerify(algorithm, key, signature, data) {
    if (!(key instanceof CryptoKey)) {
        return Promise.reject(new TypeError('key must be a CryptoKey'));
    }

    if (key.type !== 'public') {
        return Promise.reject(new DOMException('Key must be a public key', 'InvalidAccessError'));
    }

    const algoName = typeof algorithm === 'string' ? algorithm : algorithm?.name;

    if (key.algorithm.name !== algoName) {
        return Promise.reject(new DOMException('Key algorithm mismatch', 'InvalidAccessError'));
    }

    if (!key.usages.includes('verify')) {
        return Promise.reject(new DOMException('Key does not support the "verify" operation', 'InvalidAccessError'));
    }

    let sigBytes, dataBytes;

    try {
        sigBytes = toUint8Array(signature);
        dataBytes = toUint8Array(data);
    } catch (e) {
        return Promise.reject(e);
    }

    const paddingMode = algoName === 'RSA-PSS'
        ? nativeRsaVerify.RSA_PADDING_PSS
        : nativeRsaVerify.RSA_PADDING_PKCS1V15;
    const hashName = key.algorithm.hash.name;
    const hashTypeId = digestAlgorithms[hashName];
    const saltLength = algoName === 'RSA-PSS' ? algorithm.saltLength : 0;
    const { promise, resolve, reject } = Promise.withResolvers();

    nativeRsaVerify(paddingMode, hashTypeId, saltLength, key[kKeyData], sigBytes, dataBytes, (err, result) => {
        if (err) {
            reject(new DOMException(err, 'OperationError'));
        } else {
            resolve(result);
        }
    });

    return promise;
}

export function rsaImportKey(format, keyData, algorithm, extractable, keyUsages) {
    if (format !== 'spki' && format !== 'pkcs8') {
        throw new DOMException(`Unsupported key format: ${format}`, 'NotSupportedError');
    }

    const algoName = typeof algorithm === 'string' ? algorithm : algorithm?.name;
    const hashName = normalizeHashAlgorithm(algorithm.hash);
    const isPrivate = format === 'pkcs8';
    const keyType = isPrivate ? 'private' : 'public';
    let validUsages;

    if (algoName === 'RSA-OAEP') {
        validUsages = isPrivate ? [ 'decrypt', 'unwrapKey' ] : [ 'encrypt', 'wrapKey' ];
    } else {
        validUsages = isPrivate ? [ 'sign' ] : [ 'verify' ];
    }

    for (const usage of keyUsages) {
        if (!validUsages.includes(usage)) {
            throw new DOMException(`Invalid key usage for ${format}: ${usage}`, 'SyntaxError');
        }
    }

    let derBytes;

    if (ArrayBuffer.isView(keyData)) {
        derBytes = new Uint8Array(keyData.buffer.slice(keyData.byteOffset, keyData.byteOffset + keyData.byteLength));
    } else if (keyData instanceof ArrayBuffer) {
        derBytes = new Uint8Array(keyData.slice(0));
    } else {
        throw new TypeError('keyData must be a BufferSource');
    }

    const parsed = nativeRsaParseKey(derBytes, isPrivate);
    const algo = {
        name: algoName,
        modulusLength: parsed.modulusLength,
        publicExponent: parsed.publicExponent,
        hash: { name: hashName },
    };

    return new CryptoKey(keyType, extractable, algo, keyUsages, derBytes);
}

export function rsaExportKey(format, key) {
    if (!key.extractable) {
        throw new DOMException('Key is not extractable', 'InvalidAccessError');
    }

    if (key.type === 'public') {
        if (format !== 'spki') {
            throw new DOMException(`Unsupported export format for public key: ${format}`, 'NotSupportedError');
        }
    } else if (key.type === 'private') {
        if (format !== 'pkcs8') {
            throw new DOMException(`Unsupported export format for private key: ${format}`, 'NotSupportedError');
        }
    }

    return key[kKeyData].buffer.slice(0);
}
