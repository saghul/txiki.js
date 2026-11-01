
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

    // Set-Cookie values are kept as a list: they must never be combined into
    // one line (RFC 6265 § 3), so iteration yields one entry per cookie.
    append(name, value) {
        name = normalizeName(name);
        value = normalizeValue(value);
        var oldValue = this.#map[name];

        if (name === 'set-cookie') {
            if (oldValue) {
                oldValue.push(value);
            } else {
                this.#map[name] = [ value ];
            }
        } else {
            this.#map[name] = oldValue ? oldValue + ', ' + value : value;
        }
    }

    delete(name) {
        delete this.#map[normalizeName(name)];
    }

    get(name) {
        name = normalizeName(name);

        if (!this.has(name)) {
            return null;
        }

        const value = this.#map[name];

        return name === 'set-cookie' ? value.join(', ') : value;
    }

    getSetCookie() {
        return this.has('set-cookie') ? [ ...this.#map['set-cookie'] ] : [];
    }

    has(name) {
        return Object.prototype.hasOwnProperty.call(this.#map, normalizeName(name));
    }

    set(name, value) {
        name = normalizeName(name);
        value = normalizeValue(value);

        this.#map[name] = name === 'set-cookie' ? [ value ] : value;
    }

    forEach(callback, thisArg) {
        for (const name in this.#map) {
            if (Object.prototype.hasOwnProperty.call(this.#map, name)) {
                if (name === 'set-cookie') {
                    for (const value of [ ...this.#map[name] ]) {
                        callback.call(thisArg, value, name, this);
                    }
                } else {
                    callback.call(thisArg, this.#map[name], name, this);
                }
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

export function isValidHeaderName(name) {
    return /^[a-z0-9\-#$%&'*+.^_`|~!]+$/i.test(name);
}

export function trimHeaderValue(value) {
    return String(value).replace(/^[\t\n\r ]+|[\t\n\r ]+$/g, '');
}

// A CR or LF left inside a value would end the header line on the wire and
// let the rest of the value be sent as headers of its own.
export function isValidHeaderValue(value) {
    return !/[\0\r\n]/.test(value);
}

export function normalizeName(name) {
    if (typeof name !== 'string') {
        name = String(name);
    }

    if (!isValidHeaderName(name)) {
        throw new TypeError('Invalid character in header field name: "' + name + '"');
    }

    return name.toLowerCase();
}


export function normalizeValue(value) {
    value = trimHeaderValue(value);

    if (!isValidHeaderValue(value)) {
        throw new TypeError('Invalid character in header field value');
    }

    return value;
}
