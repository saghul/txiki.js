// Raw key bytes live in a module-private WeakMap so that algorithm modules can
// reach them via getKeyData(key) without exposing them on the public API of
// CryptoKey.
const keyDataMap = new WeakMap();

export function getKeyData(key) {
    return keyDataMap.get(key);
}

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
        keyDataMap.set(this, keyData);
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
