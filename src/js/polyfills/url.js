import { URLPattern } from 'urlpattern-polyfill';
import { URL, URLSearchParams } from 'whatwg-url';

globalThis.URL = URL;
globalThis.URLPattern = URLPattern;
globalThis.URLSearchParams = URLSearchParams;


const objectURLs = new Map();

globalThis.URL.createObjectURL = object => {
    if (!(object instanceof Blob)) {
        throw new TypeError('URL.createObjectURL: Argument 1 is not valid for any of the 1-argument overloads.');
    }

    const url = `blob:${crypto.randomUUID()}`;

    objectURLs.set(url, object);

    return url;
};

globalThis.URL.revokeObjectURL = url => objectURLs.delete(url);
globalThis.URL[Symbol.for('tjs.internal.url.getObjectURL')] = url => objectURLs.get(url);
