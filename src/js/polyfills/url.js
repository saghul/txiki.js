import core from 'tjs:internal/core';
import { URLPattern } from 'urlpattern-polyfill';


const NativeURL = core.URL;
const NativeURLSearchParams = core.URLSearchParams;

// Blob URL registry (must remain in JS).
const objectURLs = new Map();

// Add createObjectURL / revokeObjectURL.
NativeURL.createObjectURL = object => {
    if (!(object instanceof Blob)) {
        throw new TypeError('URL.createObjectURL: Argument 1 is not valid for any of the 1-argument overloads.');
    }

    const url = `blob:${crypto.randomUUID()}`;

    objectURLs.set(url, object);

    return url;
};

NativeURL.revokeObjectURL = url => objectURLs.delete(url);

// Internal helper for trusted polyfills (e.g. Worker) that need to resolve a
// blob: URL back to its Blob. Module-private — user code cannot reach this.
export function getObjectURL(url) {
    return objectURLs.get(url);
}

// Add Symbol.iterator to URLSearchParams.
// entries() returns an Array from native code, so wrap it in a generator
// to produce a proper iterator conforming to the iterator protocol.
NativeURLSearchParams.prototype[Symbol.iterator] = function *() {
    yield* this.entries();
};

globalThis.URL = NativeURL;
globalThis.URLSearchParams = NativeURLSearchParams;
globalThis.URLPattern = URLPattern;
