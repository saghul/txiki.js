import { aesEncrypt, aesDecrypt, aesGenerateKey, aesImportKey, aesExportKey } from './aes.js';
import { digest } from './digest.js';
import { hmacSign, hmacVerify, hmacGenerateKey, hmacImportKey, hmacExportKey } from './hmac.js';

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
                default:
                    return Promise.reject(
                        new DOMException(`Unrecognized algorithm name: ${algoName}`, 'NotSupportedError'));
            }
        } catch (e) {
            return Promise.reject(e);
        }
    }
}
