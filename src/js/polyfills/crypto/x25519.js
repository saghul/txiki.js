import { CryptoKey, kKeyData } from './crypto-key.js';
import {
    nativeX25519GenerateKey,
    nativeX25519DeriveBits,
    nativeX25519GetPublicKey,
    base64urlEncode,
    base64urlDecode,
} from './helpers.js';

// OID 1.3.101.110 (id-X25519)
const SPKI_HEADER = new Uint8Array([
    0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x03, 0x21, 0x00,
]);

const PKCS8_HEADER = new Uint8Array([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20,
]);

const validUsages = [ 'deriveBits', 'deriveKey' ];

export function x25519GenerateKey(algorithm, extractable, keyUsages) {
    for (const usage of keyUsages) {
        if (!validUsages.includes(usage)) {
            return Promise.reject(new DOMException(`Invalid key usage: ${usage}`, 'SyntaxError'));
        }
    }

    const { promise, resolve, reject } = Promise.withResolvers();

    nativeX25519GenerateKey((err, privKeyBytes, pubKeyBytes) => {
        if (err) {
            reject(new DOMException(err, 'OperationError'));

            return;
        }

        const algo = { name: 'X25519' };
        const privUsages = keyUsages.filter(u => validUsages.includes(u));

        const privateKey = new CryptoKey('private', extractable, algo, privUsages, privKeyBytes);
        const publicKey = new CryptoKey('public', true, algo, [], pubKeyBytes);

        resolve({ publicKey, privateKey });
    });

    return promise;
}

export function x25519DeriveBits(algorithm, baseKey, length, requiredUsage = 'deriveBits') {
    if (!(baseKey instanceof CryptoKey)) {
        return Promise.reject(new TypeError('baseKey must be a CryptoKey'));
    }

    if (baseKey.type !== 'private') {
        return Promise.reject(new DOMException('Key must be a private key', 'InvalidAccessError'));
    }

    if (baseKey.algorithm.name !== 'X25519') {
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

    if (pubKey.algorithm.name !== 'X25519') {
        return Promise.reject(new DOMException('Public key algorithm mismatch', 'InvalidAccessError'));
    }

    if (length !== null && (length === 0 || length % 8 !== 0)) {
        return Promise.reject(new DOMException('length must be null or a non-zero multiple of 8', 'OperationError'));
    }

    if (length !== null && length > 256) {
        return Promise.reject(new DOMException('length exceeds curve size (256 bits)', 'OperationError'));
    }

    const { promise, resolve, reject } = Promise.withResolvers();

    nativeX25519DeriveBits(baseKey[kKeyData], pubKey[kKeyData], (err, result) => {
        if (err) {
            reject(new DOMException(err, 'OperationError'));
        } else {
            const byteLength = length === null ? result.byteLength : length / 8;

            if (byteLength < result.byteLength) {
                resolve(result.buffer.slice(0, byteLength));
            } else {
                resolve(result.buffer);
            }
        }
    });

    return promise;
}

export function x25519ImportKey(format, keyData, algorithm, extractable, keyUsages) {
    if (format === 'jwk') {
        if (keyData.kty !== 'OKP') {
            throw new DOMException(`Invalid JWK key type: ${keyData.kty}`, 'DataError');
        }

        if (keyData.crv !== 'X25519') {
            throw new DOMException(`JWK curve ${keyData.crv} does not match X25519`, 'DataError');
        }

        const x = base64urlDecode(keyData.x);

        if (x.byteLength !== 32) {
            throw new DOMException('Invalid X25519 JWK public key size', 'DataError');
        }

        if (keyData.d) {
            const d = base64urlDecode(keyData.d);

            if (d.byteLength !== 32) {
                throw new DOMException('Invalid X25519 JWK private key size', 'DataError');
            }

            for (const usage of keyUsages) {
                if (!validUsages.includes(usage)) {
                    throw new DOMException(`Invalid key usage for X25519 private key: ${usage}`, 'SyntaxError');
                }
            }

            return new CryptoKey('private', extractable, { name: 'X25519' }, keyUsages, d);
        }

        for (const usage of keyUsages) {
            if (usage !== undefined) {
                throw new DOMException('X25519 public keys must have empty usages', 'SyntaxError');
            }
        }

        return new CryptoKey('public', extractable, { name: 'X25519' }, keyUsages, x);
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
        if (rawBytes.byteLength !== 32) {
            throw new DOMException(
                `Invalid key data length: expected 32 bytes, got ${rawBytes.byteLength}`, 'DataError');
        }

        if (keyUsages.length > 0) {
            throw new DOMException('X25519 public keys must have empty usages', 'SyntaxError');
        }

        return new CryptoKey('public', extractable, { name: 'X25519' }, keyUsages, rawBytes);
    }

    if (format === 'spki') {
        if (rawBytes.byteLength !== 44) {
            throw new DOMException('Invalid SPKI data length for X25519', 'DataError');
        }

        for (let i = 0; i < SPKI_HEADER.length; i++) {
            if (rawBytes[i] !== SPKI_HEADER[i]) {
                throw new DOMException('Invalid SPKI header for X25519', 'DataError');
            }
        }

        if (keyUsages.length > 0) {
            throw new DOMException('X25519 public keys must have empty usages', 'SyntaxError');
        }

        const pubkey = rawBytes.slice(SPKI_HEADER.length);

        return new CryptoKey('public', extractable, { name: 'X25519' }, keyUsages, pubkey);
    }

    if (format === 'pkcs8') {
        if (rawBytes.byteLength !== 48) {
            throw new DOMException('Invalid PKCS8 data length for X25519', 'DataError');
        }

        for (let i = 0; i < PKCS8_HEADER.length; i++) {
            if (rawBytes[i] !== PKCS8_HEADER[i]) {
                throw new DOMException('Invalid PKCS8 header for X25519', 'DataError');
            }
        }

        for (const usage of keyUsages) {
            if (!validUsages.includes(usage)) {
                throw new DOMException(`Invalid key usage for pkcs8 private key: ${usage}`, 'SyntaxError');
            }
        }

        const privkey = rawBytes.slice(PKCS8_HEADER.length);

        return new CryptoKey('private', extractable, { name: 'X25519' }, keyUsages, privkey);
    }

    throw new DOMException(`Unsupported key format: ${format}`, 'NotSupportedError');
}

export function x25519ExportKey(format, key) {
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

        const result = new Uint8Array(44);

        result.set(SPKI_HEADER, 0);
        result.set(key[kKeyData], SPKI_HEADER.length);

        return result.buffer;
    }

    if (format === 'pkcs8') {
        if (key.type !== 'private') {
            throw new DOMException('Cannot export public key as pkcs8', 'InvalidAccessError');
        }

        const result = new Uint8Array(48);

        result.set(PKCS8_HEADER, 0);
        result.set(key[kKeyData], PKCS8_HEADER.length);

        return result.buffer;
    }

    if (format === 'jwk') {
        let pubBytes;

        if (key.type === 'private') {
            pubBytes = nativeX25519GetPublicKey(key[kKeyData]);
        } else {
            pubBytes = key[kKeyData];
        }

        const jwk = {
            kty: 'OKP',
            crv: 'X25519',
            x: base64urlEncode(pubBytes),
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
