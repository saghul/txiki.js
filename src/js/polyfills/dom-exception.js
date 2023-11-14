/**
 * Defined in WebIDL 2.8.1.
 * https://webidl.spec.whatwg.org/#dfn-error-names-table
 */
const legacyCodes = {
    IndexSizeError: 1,
    HierarchyRequestError: 3,
    WrongDocumentError: 4,
    InvalidCharacterError: 5,
    NoModificationAllowedError: 7,
    NotFoundError: 8,
    NotSupportedError: 9,
    InUseAttributeError: 10,
    InvalidStateError: 11,
    SyntaxError: 12,
    InvalidModificationError: 13,
    NamespaceError: 14,
    InvalidAccessError: 15,
    TypeMismatchError: 17,
    SecurityError: 18,
    NetworkError: 19,
    AbortError: 20,
    URLMismatchError: 21,
    QuotaExceededError: 22,
    TimeoutError: 23,
    InvalidNodeTypeError: 24,
    DataCloneError: 25
};

// Defined in WebIDL 4.3.
// https://webidl.spec.whatwg.org/#idl-DOMException
class DOMException extends Error {
    // https://webidl.spec.whatwg.org/#dom-domexception-domexception
    constructor(message = '', name = 'Error') {
        super(message);
        this.name = name;
    }

    get code () {
        return legacyCodes[this.name] || 0;
    }
}

for (let key in legacyCodes) {
    const desc = { value: legacyCodes[key], enumerable: true };

    Object.defineProperty(DOMException, key, desc);
    Object.defineProperty(DOMException.prototype, key, desc);
}

Object.defineProperty(globalThis, 'DOMException', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: DOMException
});