const core = globalThis[Symbol.for('tjs.internal.core')];
const NativeHash = core.Hash;

const supportedHashes = {
    md5: NativeHash.HASH_MD5,
    sha1: NativeHash.HASH_SHA1,
    sha224: NativeHash.HASH_SHA224,
    sha256: NativeHash.HASH_SHA256,
    sha384: NativeHash.HASH_SHA384,
    sha512: NativeHash.HASH_SHA512,
    sha512_224: NativeHash.HASH_SHA512_224,
    sha512_256: NativeHash.HASH_SHA512_256,
    sha3_224: NativeHash.HASH_SHA3_224,
    sha3_256: NativeHash.HASH_SHA3_256,
    sha3_384: NativeHash.HASH_SHA3_384,
    sha3_512: NativeHash.HASH_SHA3_512,
};

class Hash {
    #native;
    #result;

    constructor(type) {
        this.#native = new NativeHash(type);
        this.#result = null;
    }

    update(data) {
        this.#native.update(data);

        return this;
    }

    digest() {
        if (!this.#result) {
            this.#result = this.#native.finish();
        }

        const bytes = this.#result;
        let hex = '';

        for (let i = 0; i < bytes.length; i++) {
            hex += (bytes[i] >> 4).toString(16) + (bytes[i] & 0xf).toString(16);
        }

        return hex;
    }

    bytes() {
        if (!this.#result) {
            this.#result = this.#native.finish();
        }

        return this.#result;
    }
}

const SUPPORTED_TYPES = Object.keys(supportedHashes);

function createHash(type) {
    const id = supportedHashes[type.toLowerCase()];

    if (id === undefined) {
        throw new TypeError('Invalid hash type: ' + type);
    }

    return new Hash(id);
}

export { createHash, SUPPORTED_TYPES };
