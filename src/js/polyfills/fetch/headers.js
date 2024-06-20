
export class Headers {
    #map;

    constructor(headers) {
        this.#map = {};

        if (headers instanceof Headers) {
            headers.forEach(function (value, name) {
                this.append(name, value);
            }, this);
        } else if (Array.isArray(headers)) {
            headers.forEach(function (header) {
                if (header.length !== 2) {
                    throw new TypeError('Expected name/value pair to be length 2, found' + header.length);
                }

                this.append(header[0], header[1]);
            }, this);
        } else if (headers) {
            Object.getOwnPropertyNames(headers).forEach(function (name) {
                this.append(name, headers[name]);
            }, this);
        }
    }

    append(name, value) {
        name = normalizeName(name);
        value = normalizeValue(value);
        var oldValue = this.#map[name];

        this.#map[name] = oldValue ? oldValue + ', ' + value : value;
    }

    delete(name) {
        delete this.#map[normalizeName(name)];
    }

    get(name) {
        name = normalizeName(name);

        return this.has(name) ? this.#map[name] : null;
    }

    has(name) {
        return Object.prototype.hasOwnProperty.call(this.#map, normalizeName(name));
    }

    set(name, value) {
        this.#map[normalizeName(name)] = normalizeValue(value);
    }

    forEach(callback, thisArg) {
        for (const name in this.#map) {
            if (Object.prototype.hasOwnProperty.call(this.#map, name)) {
                callback.call(thisArg, this.#map[name], name, this);
            }
        }
    }

    keys() {
        const items = [];

        this.forEach(function (_, name) {
            items.push(name);
        });

        return items.values();
    }

    values() {
        const items = [];

        this.forEach(function (value) {
            items.push(value);
        });

        return items.values();
    }

    entries() {
        const items = [];

        this.forEach(function (value, name) {
            items.push([ name, value ]);
        });

        return items.values();
    }

    get [Symbol.toStringTag]() {
        return 'Headers';
    }

    [Symbol.iterator]() {
        return this.entries();
    }
}

export function normalizeName(name) {
    if (typeof name !== 'string') {
        name = String(name);
    }

    if (/[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(name) || name === '') {
        throw new TypeError('Invalid character in header field name: "' + name + '"');
    }

    return name.toLowerCase();
}


export function normalizeValue(value) {
    if (typeof value !== 'string') {
        value = String(value);
    }

    return value;
}
