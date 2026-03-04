const core = globalThis[Symbol.for('tjs.internal.core')];

export const nativeDigest = core.webcrypto.digest;
export const nativeHmacSign = core.webcrypto.hmacSign;
export const nativeCipher = core.webcrypto.cipher;
export const nativePbkdf2 = core.webcrypto.pbkdf2;
export const nativeHkdf = core.webcrypto.hkdf;
export const nativeEcGenerateKey = core.webcrypto.ecGenerateKey;
export const nativeEcdsaSign = core.webcrypto.ecdsaSign;
export const nativeEcdsaVerify = core.webcrypto.ecdsaVerify;
export const nativeEcdhDeriveBits = core.webcrypto.ecdhDeriveBits;
export const nativeRsaGenerateKey = core.webcrypto.rsaGenerateKey;
export const nativeRsaOaepEncrypt = core.webcrypto.rsaOaepEncrypt;
export const nativeRsaOaepDecrypt = core.webcrypto.rsaOaepDecrypt;
export const nativeRsaSign = core.webcrypto.rsaSign;
export const nativeRsaVerify = core.webcrypto.rsaVerify;
export const nativeRsaParseKey = core.webcrypto.rsaParseKey;
export const nativeEcParseKey = core.webcrypto.ecParseKey;
export const nativeEcKeyToDer = core.webcrypto.ecKeyToDer;
export const nativeRsaExportJwk = core.webcrypto.rsaExportJwk;
export const nativeRsaImportJwk = core.webcrypto.rsaImportJwk;
export const nativeEcGetPublicKey = core.webcrypto.ecGetPublicKey;
export const nativeEd25519GenerateKey = core.webcrypto.ed25519GenerateKey;
export const nativeEd25519Sign = core.webcrypto.ed25519Sign;
export const nativeEd25519Verify = core.webcrypto.ed25519Verify;
export const nativeEd25519GetPublicKey = core.webcrypto.ed25519GetPublicKey;

export const curveIdToName = {
    [nativeEcGenerateKey.CURVE_P256]: 'P-256',
    [nativeEcGenerateKey.CURVE_P384]: 'P-384',
    [nativeEcGenerateKey.CURVE_P521]: 'P-521',
};

export const digestAlgorithms = {
    'SHA-1':   nativeDigest.DIGEST_SHA1,
    'SHA-256': nativeDigest.DIGEST_SHA256,
    'SHA-384': nativeDigest.DIGEST_SHA384,
    'SHA-512': nativeDigest.DIGEST_SHA512,
};

export const hashBlockSizes = {
    'SHA-1':   64,
    'SHA-256': 64,
    'SHA-384': 128,
    'SHA-512': 128,
};

export function toUint8Array(data) {
    if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
    }

    throw new TypeError('data must be a BufferSource');
}

export const curveAlgorithms = {
    'P-256': nativeEcGenerateKey.CURVE_P256,
    'P-384': nativeEcGenerateKey.CURVE_P384,
    'P-521': nativeEcGenerateKey.CURVE_P521,
};

export function normalizeCurve(namedCurve) {
    if (!(namedCurve in curveAlgorithms)) {
        throw new DOMException(`Unrecognized named curve: ${namedCurve}`, 'NotSupportedError');
    }

    return namedCurve;
}

export function normalizeHashAlgorithm(hash) {
    const name = typeof hash === 'string' ? hash : hash?.name;

    if (!name || !(name in digestAlgorithms)) {
        throw new DOMException(`Unrecognized hash algorithm: ${name}`, 'NotSupportedError');
    }

    return name;
}

export function base64urlEncode(bytes) {
    let binary = '';

    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');

    const pad = (4 - (str.length % 4)) % 4;

    str += '='.repeat(pad);

    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}
