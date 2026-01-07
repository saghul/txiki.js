/* global tjs */
import { defineEventAttribute } from './event-target.js';
import { mkdirSync } from './utils/mkdirSync';

const core = globalThis[Symbol.for('tjs.internal.core')];
const XHR = core.XMLHttpRequest;
const kXHR = Symbol('kXHR');
let hasHomeDirCreated = false;

class XMLHttpRequest extends EventTarget {
    static UNSENT = XHR.UNSENT;
    static OPENED = XHR.OPENED;
    static HEADERS_RECEIVED = XHR.HEADERS_RECEIVED;
    static LOADING = XHR.LOADING;
    static DONE = XHR.DONE;
    UNSENT = XHR.UNSENT;
    OPENED = XHR.OPENED;
    HEADERS_RECEIVED = XHR.HEADERS_RECEIVED;
    LOADING = XHR.LOADING;
    DONE = XHR.DONE;

    constructor() {
        super();

        const xhr = new XHR();

        xhr.onabort = () => {
            this.dispatchEvent(new Event('abort'));
        };

        xhr.onerror = () => {
            this.dispatchEvent(new Event('error'));
        };

        xhr.onload = () => {
            this.dispatchEvent(new Event('load'));
        };

        xhr.onloadend = () => {
            this.dispatchEvent(new Event('loadend'));
        };

        xhr.onloadstart = () => {
            this.dispatchEvent(new Event('loadstart'));
        };

        xhr.onprogress = p => {
            this.dispatchEvent(new ProgressEvent('progress', p));
        };

        xhr.onreadystatechange = () => {
            this.dispatchEvent(new Event('readystatechange'));
        };

        xhr.ontimeout = () => {
            this.dispatchEvent(new Event('timeout'));
        };

        this[kXHR] = xhr;
    }

    get readyState() {
        return this[kXHR].readyState;
    }

    get response() {
        return this[kXHR].response;
    }

    get responseText() {
        return this[kXHR].responseText;
    }

    set responseType(value) {
        this[kXHR].responseType = value;
    }

    get responseType() {
        return this[kXHR].responseType;
    }

    get responseURL() {
        return this[kXHR].responseURL;
    }

    get status() {
        return this[kXHR].status;
    }

    get statusText() {
        return this[kXHR].statusText;
    }

    set timeout(value) {
        this[kXHR].timeout = value;
    }

    get timeout() {
        return this[kXHR].timeout;
    }

    get upload() {
        return this[kXHR].upload;
    }

    set withCredentials(value) {
        if (value) {
            const path = globalThis[Symbol.for('tjs.internal.modules.path')];
            const TJS_HOME = tjs.env.TJS_HOME ?? path.join(tjs.homeDir, '.tjs');

            if (!hasHomeDirCreated) {
                mkdirSync(TJS_HOME, { recursive: true });
                hasHomeDirCreated = true;
            }

            this[kXHR].setCookieJar(path.join(TJS_HOME, 'cookies'));
        } else {
            this[kXHR].setCookieJar(null);
        }
    }

    get withCredentials() {
        return this[kXHR].withCredentials;
    }

    set redirectMode(value) {
        this[kXHR].redirectMode = value;
    }

    get redirectMode() {
        return this[kXHR].redirectMode;
    }

    abort() {
        return this[kXHR].abort();
    }

    getAllResponseHeaders() {
        return this[kXHR].getAllResponseHeaders();
    }

    getResponseHeader(name) {
        return this[kXHR].getResponseHeader(name);
    }

    open(...args) {
        return this[kXHR].open(...args);
    }

    overrideMimeType(mimeType) {
        return this[kXHR].overrideMimeType(mimeType);
    }

    send(body) {
        let payload;

        if (!body) {
            payload = null;
        } else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
            let buffer, offset, length;

            if (body instanceof ArrayBuffer) {
                buffer = body;
                offset = length = 0;
            } else {
                buffer = body.buffer;
                offset = body.byteOffset;
                length = body.byteLength;
            }

            payload = new Uint8Array(buffer, offset, length);
            this.setRequestHeader('Content-Type', '');
        } else if (body instanceof Blob) {
            payload = body;
            this.setRequestHeader('Content-Type', body.type);
        } else if (body instanceof URLSearchParams) {
            payload = body.toString();
            this.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
        } else if (body instanceof FormData) {
            payload = body['_blob'](); // We use a polyfill.
        } else if (body instanceof ReadableStream) {
            // Unsupported.
        } else {
            payload = String(body);
        }

        if (typeof payload === 'undefined') {
            throw new Error('Unsupported payload type');
        } else if (payload instanceof Blob) {
            payload.arrayBuffer().then(buffer => {
                this[kXHR].send(new Uint8Array(buffer));
            });
        } else {
            this[kXHR].send(payload);
        }
    }

    setRequestHeader(name, value) {
        return this[kXHR].setRequestHeader(name, value);
    }
}

const xhrProto = XMLHttpRequest.prototype;

defineEventAttribute(xhrProto, 'abort');
defineEventAttribute(xhrProto, 'error');
defineEventAttribute(xhrProto, 'load');
defineEventAttribute(xhrProto, 'loadend');
defineEventAttribute(xhrProto, 'loadstart');
defineEventAttribute(xhrProto, 'progress');
defineEventAttribute(xhrProto, 'readystatechange');
defineEventAttribute(xhrProto, 'timeout');

Object.defineProperty(window, 'XMLHttpRequest', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: XMLHttpRequest
});
