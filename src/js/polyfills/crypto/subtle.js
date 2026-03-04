import { aesEncrypt, aesDecrypt, aesGenerateKey, aesImportKey, aesExportKey } from './aes.js';
import { digest } from './digest.js';
import { normalizeHashAlgorithm, hashBlockSizes } from './helpers.js';
import { hmacSign, hmacVerify, hmacGenerateKey, hmacImportKey, hmacExportKey } from './hmac.js';
import { kdfImportKey, pbkdf2DeriveBits, hkdfDeriveBits } from './kdf.js';

export class SubtleCrypto {
    digest(algorithm, data) {
        return digest(algorithm, data);
    }

    encrypt(algorithm, key, data) {
        const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;

        switch (name) {
            case 'AES-CBC':
            case 'AES-GCM':
                return aesEncrypt(algorithm, key, data);
            default:
                return Promise.reject(new DOMException(`Unrecognized algorithm name: ${name}`, 'NotSupportedError'));
        }
    }

    decrypt(algorithm, key, data) {
        const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;

        switch (name) {
            case 'AES-CBC':
            case 'AES-GCM':
                return aesDecrypt(algorithm, key, data);
            default:
                return Promise.reject(new DOMException(`Unrecognized algorithm name: ${name}`, 'NotSupportedError'));
        }
    }

    sign(algorithm, key, data) {
        const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;

        switch (name) {
            case 'HMAC':
                return hmacSign(algorithm, key, data);
            default:
                return Promise.reject(new DOMException(`Unrecognized algorithm name: ${name}`, 'NotSupportedError'));
        }
    }

    verify(algorithm, key, signature, data) {
        const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;

        switch (name) {
            case 'HMAC':
                return hmacVerify(algorithm, key, signature, data);
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
                case 'AES-GCM':
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
                case 'AES-GCM':
                    return Promise.resolve(aesGenerateKey(algorithm, extractable, keyUsages));
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
                case 'AES-GCM':
                    return Promise.resolve(
                        aesImportKey(format, keyData, algorithm, extractable, keyUsages));
                case 'PBKDF2':
                case 'HKDF':
                    return Promise.resolve(
                        kdfImportKey(format, keyData, algorithm, extractable, keyUsages));
                default:
                    return Promise.reject(
                        new DOMException(`Unrecognized algorithm name: ${name}`, 'NotSupportedError'));
            }
        } catch (e) {
            return Promise.reject(e);
        }
    }

    exportKey(format, key) {
        const algoName = key?.algorithm?.name;

        try {
            switch (algoName) {
                case 'HMAC':
                    return Promise.resolve(hmacExportKey(format, key));
                case 'AES-CBC':
                case 'AES-GCM':
                    return Promise.resolve(aesExportKey(format, key));
                case 'PBKDF2':
                case 'HKDF':
                    return Promise.reject(
                        new DOMException('KDF keys are not exportable', 'InvalidAccessError'));
                default:
                    return Promise.reject(
                        new DOMException(`Unrecognized algorithm name: ${algoName}`, 'NotSupportedError'));
            }
        } catch (e) {
            return Promise.reject(e);
        }
    }
}
