import { aesEncrypt, aesDecrypt, aesGenerateKey, aesImportKey, aesExportKey, aesKwWrap, aesKwUnwrap } from './aes.js';
import { digest } from './digest.js';
import { ecGenerateKey, ecdsaSign, ecdsaVerify, ecdhDeriveBits, ecImportKey, ecExportKey } from './ec.js';
import { ed25519GenerateKey, ed25519Sign, ed25519Verify, ed25519ImportKey, ed25519ExportKey } from './ed.js';
import { normalizeHashAlgorithm, hashBlockSizes } from './helpers.js';
import { hmacSign, hmacVerify, hmacGenerateKey, hmacImportKey, hmacExportKey } from './hmac.js';
import { kdfImportKey, pbkdf2DeriveBits, hkdfDeriveBits } from './kdf.js';
import {
    rsaGenerateKey, rsaOaepEncrypt, rsaOaepDecrypt,
    rsaSign, rsaVerify, rsaImportKey, rsaExportKey,
} from './rsa.js';
import { x25519GenerateKey, x25519DeriveBits, x25519ImportKey, x25519ExportKey } from './x25519.js';

export class SubtleCrypto {
    digest(algorithm, data) {
        return digest(algorithm, data);
    }

    encrypt(algorithm, key, data) {
        const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;

        switch (name) {
            case 'AES-CBC':
            case 'AES-CTR':
            case 'AES-GCM':
                return aesEncrypt(algorithm, key, data);
            case 'RSA-OAEP':
                return rsaOaepEncrypt(algorithm, key, data);
            default:
                return Promise.reject(new DOMException(`Unrecognized algorithm name: ${name}`, 'NotSupportedError'));
        }
    }

    decrypt(algorithm, key, data) {
        const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;

        switch (name) {
            case 'AES-CBC':
            case 'AES-CTR':
            case 'AES-GCM':
                return aesDecrypt(algorithm, key, data);
            case 'RSA-OAEP':
                return rsaOaepDecrypt(algorithm, key, data);
            default:
                return Promise.reject(new DOMException(`Unrecognized algorithm name: ${name}`, 'NotSupportedError'));
        }
    }

    sign(algorithm, key, data) {
        const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;

        switch (name) {
            case 'HMAC':
                return hmacSign(algorithm, key, data);
            case 'ECDSA':
                return ecdsaSign(algorithm, key, data);
            case 'Ed25519':
                return ed25519Sign(algorithm, key, data);
            case 'RSA-PSS':
            case 'RSASSA-PKCS1-v1_5':
                return rsaSign(algorithm, key, data);
            default:
                return Promise.reject(new DOMException(`Unrecognized algorithm name: ${name}`, 'NotSupportedError'));
        }
    }

    verify(algorithm, key, signature, data) {
        const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;

        switch (name) {
            case 'HMAC':
                return hmacVerify(algorithm, key, signature, data);
            case 'ECDSA':
                return ecdsaVerify(algorithm, key, signature, data);
            case 'Ed25519':
                return ed25519Verify(algorithm, key, signature, data);
            case 'RSA-PSS':
            case 'RSASSA-PKCS1-v1_5':
                return rsaVerify(algorithm, key, signature, data);
            default:
                return Promise.reject(new DOMException(`Unrecognized algorithm name: ${name}`, 'NotSupportedError'));
        }
    }

    deriveBits(algorithm, baseKey, length) {
        const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;

        switch (name) {
            case 'PBKDF2':
                return pbkdf2DeriveBits(algorithm, baseKey, length);
            case 'HKDF':
                return hkdfDeriveBits(algorithm, baseKey, length);
            case 'ECDH':
                return ecdhDeriveBits(algorithm, baseKey, length);
            case 'X25519':
                return x25519DeriveBits(algorithm, baseKey, length);
            default:
                return Promise.reject(new DOMException(`Unrecognized algorithm name: ${name}`, 'NotSupportedError'));
        }
    }

    deriveKey(algorithm, baseKey, derivedKeyType, extractable, keyUsages) {
        const dktName = typeof derivedKeyType === 'string' ? derivedKeyType : derivedKeyType?.name;
        let length;

        try {
            switch (dktName) {
                case 'AES-CBC':
                case 'AES-CTR':
                case 'AES-GCM':
                case 'AES-KW':
                    length = derivedKeyType.length;
                    break;

                case 'HMAC': {
                    const hashName = normalizeHashAlgorithm(derivedKeyType.hash);

                    length = derivedKeyType.length || (hashBlockSizes[hashName] * 8);
                    break;
                }

                default:
                    return Promise.reject(
                        new DOMException(`Unrecognized derived key type: ${dktName}`, 'NotSupportedError'));
            }
        } catch (e) {
            return Promise.reject(e);
        }

        const algoName = typeof algorithm === 'string' ? algorithm : algorithm?.name;
        let bitsPromise;

        switch (algoName) {
            case 'PBKDF2':
                bitsPromise = pbkdf2DeriveBits(algorithm, baseKey, length, 'deriveKey');
                break;
            case 'HKDF':
                bitsPromise = hkdfDeriveBits(algorithm, baseKey, length, 'deriveKey');
                break;
            case 'ECDH':
                bitsPromise = ecdhDeriveBits(algorithm, baseKey, length, 'deriveKey');
                break;
            case 'X25519':
                bitsPromise = x25519DeriveBits(algorithm, baseKey, length, 'deriveKey');
                break;
            default:
                return Promise.reject(
                    new DOMException(`Unrecognized algorithm name: ${algoName}`, 'NotSupportedError'));
        }

        return bitsPromise
            .then(bits => this.importKey('raw', bits, derivedKeyType, extractable, keyUsages));
    }

    generateKey(algorithm, extractable, keyUsages) {
        const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;

        try {
            switch (name) {
                case 'HMAC':
                    return Promise.resolve(hmacGenerateKey(algorithm, extractable, keyUsages));
                case 'AES-CBC':
                case 'AES-CTR':
                case 'AES-GCM':
                case 'AES-KW':
                    return Promise.resolve(aesGenerateKey(algorithm, extractable, keyUsages));
                case 'ECDSA':
                case 'ECDH':
                    return ecGenerateKey(algorithm, extractable, keyUsages);
                case 'Ed25519':
                    return ed25519GenerateKey(algorithm, extractable, keyUsages);
                case 'X25519':
                    return x25519GenerateKey(algorithm, extractable, keyUsages);
                case 'RSA-OAEP':
                case 'RSA-PSS':
                case 'RSASSA-PKCS1-v1_5':
                    return rsaGenerateKey(algorithm, extractable, keyUsages);
                default:
                    return Promise.reject(
                        new DOMException(`Unrecognized algorithm name: ${name}`, 'NotSupportedError'));
            }
        } catch (e) {
            return Promise.reject(e);
        }
    }

    importKey(format, keyData, algorithm, extractable, keyUsages) {
        const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;

        try {
            switch (name) {
                case 'HMAC':
                    return Promise.resolve(
                        hmacImportKey(format, keyData, algorithm, extractable, keyUsages));
                case 'AES-CBC':
                case 'AES-CTR':
                case 'AES-GCM':
                case 'AES-KW':
                    return Promise.resolve(
                        aesImportKey(format, keyData, algorithm, extractable, keyUsages));
                case 'PBKDF2':
                case 'HKDF':
                    return Promise.resolve(
                        kdfImportKey(format, keyData, algorithm, extractable, keyUsages));
                case 'ECDSA':
                case 'ECDH':
                    return Promise.resolve(
                        ecImportKey(format, keyData, algorithm, extractable, keyUsages));
                case 'Ed25519':
                    return Promise.resolve(
                        ed25519ImportKey(format, keyData, algorithm, extractable, keyUsages));
                case 'X25519':
                    return Promise.resolve(
                        x25519ImportKey(format, keyData, algorithm, extractable, keyUsages));
                case 'RSA-OAEP':
                case 'RSA-PSS':
                case 'RSASSA-PKCS1-v1_5':
                    return Promise.resolve(
                        rsaImportKey(format, keyData, algorithm, extractable, keyUsages));
                default:
                    return Promise.reject(
                        new DOMException(`Unrecognized algorithm name: ${name}`, 'NotSupportedError'));
            }
        } catch (e) {
            return Promise.reject(e);
        }
    }

    wrapKey(format, key, wrappingKey, wrapAlgorithm) {
        if (!wrappingKey?.usages?.includes('wrapKey')) {
            return Promise.reject(
                new DOMException('Key does not support the "wrapKey" operation', 'InvalidAccessError'));
        }

        if (!key?.extractable) {
            return Promise.reject(
                new DOMException('Key is not extractable', 'InvalidAccessError'));
        }

        return this.exportKey(format, key).then(exported => {
            const data = format === 'jwk'
                ? new TextEncoder().encode(JSON.stringify(exported))
                : new Uint8Array(exported);

            const name = typeof wrapAlgorithm === 'string' ? wrapAlgorithm : wrapAlgorithm?.name;

            switch (name) {
                case 'AES-CBC':
                case 'AES-CTR':
                case 'AES-GCM':
                    return aesEncrypt(wrapAlgorithm, wrappingKey, data, 'wrapKey');
                case 'AES-KW':
                    return aesKwWrap(wrappingKey, data);
                case 'RSA-OAEP':
                    return rsaOaepEncrypt(wrapAlgorithm, wrappingKey, data, 'wrapKey');
                default:
                    throw new DOMException(`Unrecognized algorithm name: ${name}`, 'NotSupportedError');
            }
        });
    }

    unwrapKey(format, wrappedKey, unwrappingKey, unwrapAlgorithm, unwrappedKeyAlgorithm, extractable, keyUsages) {
        if (!unwrappingKey?.usages?.includes('unwrapKey')) {
            return Promise.reject(
                new DOMException('Key does not support the "unwrapKey" operation', 'InvalidAccessError'));
        }

        const name = typeof unwrapAlgorithm === 'string' ? unwrapAlgorithm : unwrapAlgorithm?.name;
        let decryptPromise;

        switch (name) {
            case 'AES-CBC':
            case 'AES-CTR':
            case 'AES-GCM':
                decryptPromise = aesDecrypt(unwrapAlgorithm, unwrappingKey, wrappedKey, 'unwrapKey');
                break;
            case 'AES-KW':
                decryptPromise = aesKwUnwrap(unwrappingKey, wrappedKey);
                break;
            case 'RSA-OAEP':
                decryptPromise = rsaOaepDecrypt(unwrapAlgorithm, unwrappingKey, wrappedKey, 'unwrapKey');
                break;
            default:
                return Promise.reject(
                    new DOMException(`Unrecognized algorithm name: ${name}`, 'NotSupportedError'));
        }

        return decryptPromise.then(decrypted => {
            let keyData;

            if (format === 'jwk') {
                // Trim trailing zero bytes (AES-KW pads to 8-byte boundary)
                let bytes = new Uint8Array(decrypted);
                let end = bytes.length;

                while (end > 0 && bytes[end - 1] === 0) {
                    end--;
                }

                keyData = JSON.parse(new TextDecoder().decode(bytes.subarray(0, end)));
            } else {
                keyData = decrypted;
            }

            return this.importKey(format, keyData, unwrappedKeyAlgorithm, extractable, keyUsages);
        });
    }

    exportKey(format, key) {
        const algoName = key?.algorithm?.name;

        try {
            switch (algoName) {
                case 'HMAC':
                    return Promise.resolve(hmacExportKey(format, key));
                case 'AES-CBC':
                case 'AES-CTR':
                case 'AES-GCM':
                case 'AES-KW':
                    return Promise.resolve(aesExportKey(format, key));
                case 'PBKDF2':
                case 'HKDF':
                    return Promise.reject(
                        new DOMException('KDF keys are not exportable', 'InvalidAccessError'));
                case 'ECDSA':
                case 'ECDH':
                    return Promise.resolve(ecExportKey(format, key));
                case 'Ed25519':
                    return Promise.resolve(ed25519ExportKey(format, key));
                case 'X25519':
                    return Promise.resolve(x25519ExportKey(format, key));
                case 'RSA-OAEP':
                case 'RSA-PSS':
                case 'RSASSA-PKCS1-v1_5':
                    return Promise.resolve(rsaExportKey(format, key));
                default:
                    return Promise.reject(
                        new DOMException(`Unrecognized algorithm name: ${algoName}`, 'NotSupportedError'));
            }
        } catch (e) {
            return Promise.reject(e);
        }
    }
}
