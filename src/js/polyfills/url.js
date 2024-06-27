import { URLPattern } from 'urlpattern-polyfill';
import { URL, URLSearchParams } from 'whatwg-url';

globalThis.URL = URL;
globalThis.URLPattern = URLPattern;
globalThis.URLSearchParams = URLSearchParams;

let _objectURLs;
Object.defineProperty(globalThis, 'objectURLs', {
    enumerable: false,
    configurable: false,
    get: () => {
        if (!_objectURLs) {
            _objectURLs = new Map();
        }
        return _objectURLs;
    }
});

// TODO: straggly, without the wrapped console.log, the runtime will abort
// more investigation is needed
globalThis.URL.createObjectURL = (object) => {
    console.log('');
    if  (String(object) !== '[object Blob]') {
        throw new TypeError("URL.createObjectURL: Argument 1 is not valid for any of the 1-argument overloads.");
    }
    const url = `blob:${crypto.randomUUID()}`;
    objectURLs.set(url, object.text()); // store the promise, will computed at most once
    return url;
}
globalThis.URL.revokeObjectURL = (url) => {
    console.log('');
    return objectURLs.delete(url);
}
