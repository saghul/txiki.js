import { CryptoKey, kKeyData } from './crypto-key.js';
import { nativeCipher, toUint8Array, base64urlEncode, base64urlDecode } from './helpers.js';

const CIPHER_AES_CBC = nativeCipher.CIPHER_AES_CBC;
const CIPHER_AES_GCM = nativeCipher.CIPHER_AES_GCM;
const CIPHER_OP_ENCRYPT = nativeCipher.CIPHER_OP_ENCRYPT;
const CIPHER_OP_DECRYPT = nativeCipher.CIPHER_OP_DECRYPT;

const cipherTypes = {
    'AES-CBC': CIPHER_AES_CBC,
    'AES-GCM': CIPHER_AES_GCM,
};

const validAesUsages = [ 'encrypt', 'decrypt', 'wrapKey', 'unwrapKey' ];
const validTagLengths = [ 32, 64, 96, 104, 112, 120, 128 ];

function cipherOp(cipherType, operation, key, iv, data, aad, tagLengthBytes) {
    const { promise, resolve, reject } = Promise.withResolvers();

    nativeCipher(cipherType, operation, key, iv, data, aad, tagLengthBytes, (err, result) => {
        if (err) {
            reject(new DOMException(err, 'OperationError'));
        } else {
            resolve(result);
        }
    });

    return promise;
}

export function aesEncrypt(algorithm, key, data) {
    if (!(key instanceof CryptoKey)) {
        return Promise.reject(new TypeError('key must be a CryptoKey'));
    }

    if (!key.usages.includes('encrypt')) {
        return Promise.reject(new DOMException('Key does not support the "encrypt" operation', 'InvalidAccessError'));
    }

    const algoName = typeof algorithm === 'string' ? algorithm : algorithm?.name;

    if (!(algoName in cipherTypes)) {
        return Promise.reject(new DOMException(`Unrecognized algorithm name: ${algoName}`, 'NotSupportedError'));
    }

    let bytes;

    try {
        bytes = toUint8Array(data);
    } catch (e) {
        return Promise.reject(e);
    }

    const cipherType = cipherTypes[algoName];

    if (algoName === 'AES-CBC') {
        let iv;

        try {
            iv = toUint8Array(algorithm.iv);
        } catch (e) {
            return Promise.reject(e);
        }

        if (iv.byteLength !== 16) {
            return Promise.reject(new DOMException('AES-CBC IV must be 16 bytes', 'OperationError'));
        }

        return cipherOp(cipherType, CIPHER_OP_ENCRYPT, key[kKeyData], iv, bytes, undefined, 0)
            .then(r => r.buffer);
    }

    if (algoName === 'AES-GCM') {
        let iv;

        try {
            iv = toUint8Array(algorithm.iv);
        } catch (e) {
            return Promise.reject(e);
        }

        let aad;

        if (algorithm.additionalData !== undefined) {
            try {
                aad = toUint8Array(algorithm.additionalData);
            } catch (e) {
                return Promise.reject(e);
            }
        }

        const tagLengthBits = algorithm.tagLength || 128;

        if (!validTagLengths.includes(tagLengthBits)) {
            return Promise.reject(new DOMException(`Invalid tagLength: ${tagLengthBits}`, 'OperationError'));
        }

        const tagLengthBytes = tagLengthBits / 8;

        return cipherOp(cipherType, CIPHER_OP_ENCRYPT, key[kKeyData], iv, bytes, aad, tagLengthBytes)
            .then(r => r.buffer);
    }
}

export function aesDecrypt(algorithm, key, data) {
    if (!(key instanceof CryptoKey)) {
        return Promise.reject(new TypeError('key must be a CryptoKey'));
    }

    if (!key.usages.includes('decrypt')) {
        return Promise.reject(new DOMException('Key does not support the "decrypt" operation', 'InvalidAccessError'));
    }

    const algoName = typeof algorithm === 'string' ? algorithm : algorithm?.name;

    if (!(algoName in cipherTypes)) {
        return Promise.reject(new DOMException(`Unrecognized algorithm name: ${algoName}`, 'NotSupportedError'));
    }

    let bytes;

    try {
        bytes = toUint8Array(data);
    } catch (e) {
        return Promise.reject(e);
    }

    const cipherType = cipherTypes[algoName];

    if (algoName === 'AES-CBC') {
        let iv;

        try {
            iv = toUint8Array(algorithm.iv);
        } catch (e) {
            return Promise.reject(e);
        }

        if (iv.byteLength !== 16) {
            return Promise.reject(new DOMException('AES-CBC IV must be 16 bytes', 'OperationError'));
        }

        return cipherOp(cipherType, CIPHER_OP_DECRYPT, key[kKeyData], iv, bytes, undefined, 0)
            .then(r => r.buffer);
    }

    if (algoName === 'AES-GCM') {
        let iv;

        try {
            iv = toUint8Array(algorithm.iv);
        } catch (e) {
            return Promise.reject(e);
        }

        let aad;

        if (algorithm.additionalData !== undefined) {
            try {
                aad = toUint8Array(algorithm.additionalData);
            } catch (e) {
                return Promise.reject(e);
            }
        }

        const tagLengthBits = algorithm.tagLength || 128;

        if (!validTagLengths.includes(tagLengthBits)) {
            return Promise.reject(new DOMException(`Invalid tagLength: ${tagLengthBits}`, 'OperationError'));
        }

        const tagLengthBytes = tagLengthBits / 8;

        return cipherOp(cipherType, CIPHER_OP_DECRYPT, key[kKeyData], iv, bytes, aad, tagLengthBytes)
            .then(r => r.buffer);
    }
}

export function aesGenerateKey(algorithm, extractable, keyUsages) {
    const algoName = typeof algorithm === 'string' ? algorithm : algorithm?.name;
    const length = algorithm.length;

    if (length !== 128 && length !== 192 && length !== 256) {
        throw new DOMException(`Invalid AES key length: ${length}`, 'OperationError');
    }

    for (const usage of keyUsages) {
        if (!validAesUsages.includes(usage)) {
            throw new DOMException(`Invalid key usage: ${usage}`, 'SyntaxError');
        }
    }

    const byteLength = length / 8;
    const keyData = new Uint8Array(byteLength);

    crypto.getRandomValues(keyData);

    return new CryptoKey('secret', extractable, { name: algoName, length }, keyUsages, keyData);
}

function aesJwkAlg(algoName, bitLength) {
    const prefix = `A${bitLength}`;

    if (algoName === 'AES-GCM') {
        return `${prefix}GCM`;
    }

    if (algoName === 'AES-CBC') {
        return `${prefix}CBC`;
    }

    return undefined;
}

export function aesImportKey(format, keyData, algorithm, extractable, keyUsages) {
    if (format !== 'raw' && format !== 'jwk') {
        throw new DOMException(`Unsupported key format: ${format}`, 'NotSupportedError');
    }

    const algoName = typeof algorithm === 'string' ? algorithm : algorithm?.name;

    for (const usage of keyUsages) {
        if (!validAesUsages.includes(usage)) {
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

    if (rawBytes.byteLength !== 16 && rawBytes.byteLength !== 24 && rawBytes.byteLength !== 32) {
        throw new DOMException(`Invalid AES key length: ${rawBytes.byteLength * 8} bits`, 'DataError');
    }

    const length = rawBytes.byteLength * 8;

    return new CryptoKey('secret', extractable, { name: algoName, length }, keyUsages, rawBytes);
}

export function aesExportKey(format, key) {
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
            alg: aesJwkAlg(key.algorithm.name, key.algorithm.length),
            ext: key.extractable,
            key_ops: [ ...key.usages ],
        };
    }

    return key[kKeyData].buffer.slice(0);
}
