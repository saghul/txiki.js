import { digest } from './digest.js';
import { hmacSign, hmacVerify, hmacGenerateKey, hmacImportKey, hmacExportKey } from './hmac.js';

export class SubtleCrypto {
    digest(algorithm, data) {
        return digest(algorithm, data);
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
                default:
                    return Promise.reject(new DOMException(`Unrecognized algorithm name: ${name}`, 'NotSupportedError'));
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
                    return Promise.resolve(hmacImportKey(format, keyData, algorithm, extractable, keyUsages));
                default:
                    return Promise.reject(new DOMException(`Unrecognized algorithm name: ${name}`, 'NotSupportedError'));
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
                default:
                    return Promise.reject(new DOMException(`Unrecognized algorithm name: ${algoName}`, 'NotSupportedError'));
            }
        } catch (e) {
            return Promise.reject(e);
        }
    }
}
