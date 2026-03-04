import { CryptoKey, kKeyData } from './crypto-key.js';
import {
    nativeEd25519GenerateKey,
    nativeEd25519Sign,
    nativeEd25519Verify,
    nativeEd25519GetPublicKey,
    toUint8Array,
    base64urlEncode,
    base64urlDecode,
} from './helpers.js';

const SPKI_HEADER = new Uint8Array([
    0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);

const PKCS8_HEADER = new Uint8Array([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

export function ed25519GenerateKey(algorithm, extractable, keyUsages) {
    const validUsages = [ 'sign', 'verify' ];

    for (const usage of keyUsages) {
        if (!validUsages.includes(usage)) {
            throw new DOMException(`Invalid key usage: ${usage}`, 'SyntaxError');
        }
    }

    const { promise, resolve, reject } = Promise.withResolvers();

    nativeEd25519GenerateKey((err, privKeyBytes, pubKeyBytes) => {
        if (err) {
            reject(new DOMException(err, 'OperationError'));

            return;
        }

        const algo = { name: 'Ed25519' };
        const privUsages = keyUsages.filter(u => u === 'sign');
        const pubUsages = keyUsages.filter(u => u === 'verify');

        const privateKey = new CryptoKey('private', extractable, algo, privUsages, privKeyBytes);
        const publicKey = new CryptoKey('public', true, algo, pubUsages, pubKeyBytes);

        resolve({ publicKey, privateKey });
    });

    return promise;
}

export function ed25519Sign(algorithm, key, data) {
    if (!(key instanceof CryptoKey)) {
        return Promise.reject(new TypeError('key must be a CryptoKey'));
    }

    if (key.type !== 'private') {
        return Promise.reject(new DOMException('Key must be a private key', 'InvalidAccessError'));
    }

    if (key.algorithm.name !== 'Ed25519') {
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

    const { promise, resolve, reject } = Promise.withResolvers();

    nativeEd25519Sign(key[kKeyData], bytes, (err, result) => {
        if (err) {
            reject(new DOMException(err, 'OperationError'));
        } else {
            resolve(result.buffer);
        }
    });

    return promise;
}

export function ed25519Verify(algorithm, key, signature, data) {
    if (!(key instanceof CryptoKey)) {
        return Promise.reject(new TypeError('key must be a CryptoKey'));
    }

    if (key.type !== 'public') {
        return Promise.reject(new DOMException('Key must be a public key', 'InvalidAccessError'));
    }

    if (key.algorithm.name !== 'Ed25519') {
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

    const { promise, resolve, reject } = Promise.withResolvers();

    nativeEd25519Verify(key[kKeyData], sigBytes, dataBytes, (err, result) => {
        if (err) {
            reject(new DOMException(err, 'OperationError'));
        } else {
            resolve(result);
        }
    });

    return promise;
}

export function ed25519ImportKey(format, keyData, algorithm, extractable, keyUsages) {
    if (format === 'jwk') {
        if (keyData.kty !== 'OKP') {
            throw new DOMException(`Invalid JWK key type: ${keyData.kty}`, 'DataError');
        }

        if (keyData.crv !== 'Ed25519') {
            throw new DOMException(`JWK curve ${keyData.crv} does not match Ed25519`, 'DataError');
        }

        const x = base64urlDecode(keyData.x);

        if (x.byteLength !== 32) {
            throw new DOMException('Invalid Ed25519 JWK public key size', 'DataError');
        }

        if (keyData.d) {
            const d = base64urlDecode(keyData.d);

            if (d.byteLength !== 32) {
                throw new DOMException('Invalid Ed25519 JWK private key size', 'DataError');
            }

            for (const usage of keyUsages) {
                if (usage !== 'sign') {
                    throw new DOMException(`Invalid key usage for Ed25519 private key: ${usage}`, 'SyntaxError');
                }
            }

            return new CryptoKey('private', extractable, { name: 'Ed25519' }, keyUsages, d);
        }

        for (const usage of keyUsages) {
            if (usage !== 'verify') {
                throw new DOMException(`Invalid key usage for Ed25519 public key: ${usage}`, 'SyntaxError');
            }
        }

        return new CryptoKey('public', extractable, { name: 'Ed25519' }, keyUsages, x);
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

        for (const usage of keyUsages) {
            if (usage !== 'verify') {
                throw new DOMException(`Invalid key usage for raw public key: ${usage}`, 'SyntaxError');
            }
        }

        return new CryptoKey('public', extractable, { name: 'Ed25519' }, keyUsages, rawBytes);
    }

    if (format === 'spki') {
        if (rawBytes.byteLength !== 44) {
            throw new DOMException('Invalid SPKI data length for Ed25519', 'DataError');
        }

        for (let i = 0; i < SPKI_HEADER.length; i++) {
            if (rawBytes[i] !== SPKI_HEADER[i]) {
                throw new DOMException('Invalid SPKI header for Ed25519', 'DataError');
            }
        }

        for (const usage of keyUsages) {
            if (usage !== 'verify') {
                throw new DOMException(`Invalid key usage for spki public key: ${usage}`, 'SyntaxError');
            }
        }

        const pubkey = rawBytes.slice(SPKI_HEADER.length);

        return new CryptoKey('public', extractable, { name: 'Ed25519' }, keyUsages, pubkey);
    }

    if (format === 'pkcs8') {
        if (rawBytes.byteLength !== 48) {
            throw new DOMException('Invalid PKCS8 data length for Ed25519', 'DataError');
        }

        for (let i = 0; i < PKCS8_HEADER.length; i++) {
            if (rawBytes[i] !== PKCS8_HEADER[i]) {
                throw new DOMException('Invalid PKCS8 header for Ed25519', 'DataError');
            }
        }

        for (const usage of keyUsages) {
            if (usage !== 'sign') {
                throw new DOMException(`Invalid key usage for pkcs8 private key: ${usage}`, 'SyntaxError');
            }
        }

        const privkey = rawBytes.slice(PKCS8_HEADER.length);

        return new CryptoKey('private', extractable, { name: 'Ed25519' }, keyUsages, privkey);
    }

    throw new DOMException(`Unsupported key format: ${format}`, 'NotSupportedError');
}

export function ed25519ExportKey(format, key) {
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
            pubBytes = nativeEd25519GetPublicKey(key[kKeyData]);
        } else {
            pubBytes = key[kKeyData];
        }

        const jwk = {
            kty: 'OKP',
            crv: 'Ed25519',
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
