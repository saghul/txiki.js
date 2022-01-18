import md5 from 'js-md5';
import sha1 from 'js-sha1';
import { sha256, sha224 } from 'js-sha256';
import { sha512, sha384, sha512_256, sha512_224 } from 'js-sha512';
import { sha3_512, sha3_384, sha3_256, sha3_224 } from 'js-sha3';


const kHashObj = Symbol('kHashObj');
const supportedHashes = {
    md5,
    sha1,
    sha256,
    sha224,
    sha512,
    sha384,
    sha512_256,
    sha512_224,
    sha3_512,
    sha3_384,
    sha3_256,
    sha3_224
}

class Hash {
    constructor(obj) {
        this[kHashObj] = obj.create();
    }

    update(data) {
        this[kHashObj].update(data);
        return this;
    }

    digest() {
        return this[kHashObj].hex();
    }

    bytes() {
        return new Uint8Array(this[kHashObj].array());
    }
}

function createHash(type) {
    const obj = supportedHashes[type.toLowerCase()];

    if (!obj) {
        throw new TypeError('Invalid hash type: ' + type);
    }

    return new Hash(obj);
}

createHash.SUPPORTED_TYPES = Object.keys(supportedHashes);

export default createHash;
