export const kKeyData = Symbol('CryptoKey.keyData');

export class CryptoKey {
    #type;
    #extractable;
    #algorithm;
    #usages;

    constructor(type, extractable, algorithm, usages, keyData) {
        this.#type = type;
        this.#extractable = extractable;
        this.#algorithm = Object.freeze({ ...algorithm });
        this.#usages = Object.freeze([ ...usages ]);
        this[kKeyData] = keyData;
    }

    get type() {
        return this.#type;
    }

    get extractable() {
        return this.#extractable;
    }

    get algorithm() {
        return this.#algorithm;
    }

    get usages() {
        return this.#usages;
    }
}
