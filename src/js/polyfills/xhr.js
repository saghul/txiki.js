/* global tjs */
import { defineEventAttribute } from './event-target.js';
import { mkdirSync } from './utils/mkdirSync';

const core = globalThis[Symbol.for('tjs.internal.core')];
const HttpClient = core.HttpClient;
const kClient = Symbol('kClient');
let hasHomeDirCreated = false;

class XMLHttpRequest extends EventTarget {
    static UNSENT = 0;
    static OPENED = 1;
    static HEADERS_RECEIVED = 2;
    static LOADING = 3;
    static DONE = 4;
    UNSENT = 0;
    OPENED = 1;
    HEADERS_RECEIVED = 2;
    LOADING = 3;
    DONE = 4;

    #readyState = XMLHttpRequest.UNSENT;
    #status = 0;
    #statusText = '';
    #responseURL = '';
    #responseHeaders = '';
    #responseBody = new Uint8Array(0);
    #responseType = '';
    #timeout = 0;
    #withCredentials = false;
    #cookieJarPath = null;

    constructor() {
        super();
        this[kClient] = null;
    }

    #createClient() {
        const client = new HttpClient();

        client.onresponse = (status, statusText, url, headers) => {
            this.#status = status;
            this.#statusText = statusText;
            this.#responseURL = url;
            this.#responseHeaders = headers;
            this.#setReadyState(XMLHttpRequest.HEADERS_RECEIVED);
        };

        client.ondata = (chunk, contentLength) => {
            if (this.#readyState === XMLHttpRequest.HEADERS_RECEIVED) {
                this.#setReadyState(XMLHttpRequest.LOADING);
            }

            // Accumulate body data
            const oldBody = this.#responseBody;
            const newChunk = new Uint8Array(chunk);
            const newBody = new Uint8Array(oldBody.length + newChunk.length);

            newBody.set(oldBody);
            newBody.set(newChunk, oldBody.length);
            this.#responseBody = newBody;

            const lengthComputable = contentLength > 0;

            this.dispatchEvent(new ProgressEvent('progress', {
                lengthComputable: lengthComputable,
                loaded: this.#responseBody.length,
                total: lengthComputable ? contentLength : 0
            }));
        };

        client.oncomplete = error => {
            if (error && error === 'Request aborted') {
                this.#readyState = XMLHttpRequest.UNSENT;
                this.#status = 0;
                this.#statusText = '';
                this.dispatchEvent(new Event('abort'));
            } else {
                this.#setReadyState(XMLHttpRequest.DONE);

                if (error) {
                    if (error === 'Request timed out') {
                        this.dispatchEvent(new Event('timeout'));
                    } else {
                        this.dispatchEvent(new Event('error'));
                    }
                } else {
                    this.dispatchEvent(new Event('load'));
                }
            }

            this.dispatchEvent(new Event('loadend'));
        };

        if (this.#timeout > 0) {
            client.timeout = this.#timeout;
        }

        if (this.#cookieJarPath) {
            client.setCookieJar(this.#cookieJarPath);
        }

        this[kClient] = client;
    }

    #setReadyState(state) {
        if (this.#readyState !== state) {
            this.#readyState = state;
            this.dispatchEvent(new Event('readystatechange'));
        }
    }

    get readyState() {
        return this.#readyState;
    }

    get response() {
        if (this.#responseBody.length === 0) {
            return null;
        }

        switch (this.#responseType) {
            case '':
            case 'text':
                return new TextDecoder().decode(this.#responseBody);
            case 'arraybuffer':
                return this.#responseBody.buffer.slice(
                    this.#responseBody.byteOffset,
                    this.#responseBody.byteOffset + this.#responseBody.byteLength
                );

            case 'json': {
                const text = new TextDecoder().decode(this.#responseBody);

                return JSON.parse(text);
            }

            default:
                return null;
        }
    }

    get responseText() {
        if (this.#responseBody.length === 0) {
            return null;
        }

        return new TextDecoder().decode(this.#responseBody);
    }

    set responseType(value) {
        this.#responseType = value;
    }

    get responseType() {
        return this.#responseType;
    }

    get responseURL() {
        return this.#responseURL;
    }

    get status() {
        return this.#status;
    }

    get statusText() {
        return this.#statusText;
    }

    set timeout(value) {
        this.#timeout = value;

        if (this[kClient]) {
            this[kClient].timeout = value;
        }
    }

    get timeout() {
        return this.#timeout;
    }

    get upload() {
        // TODO: not implemented.
        return undefined;
    }

    set withCredentials(value) {
        if (value) {
            const path = globalThis[Symbol.for('tjs.internal.modules.path')];
            const TJS_HOME = tjs.env.TJS_HOME ?? path.join(tjs.homeDir, '.tjs');

            if (!hasHomeDirCreated) {
                mkdirSync(TJS_HOME, { recursive: true });
                hasHomeDirCreated = true;
            }

            this.#cookieJarPath = path.join(TJS_HOME, 'cookies');
        } else {
            this.#cookieJarPath = null;
        }

        this.#withCredentials = value;
    }

    get withCredentials() {
        return this.#withCredentials;
    }

    abort() {
        if (this[kClient]) {
            this[kClient].abort();
            this[kClient] = null;
        }
    }

    getAllResponseHeaders() {
        if (this.#responseHeaders.length === 0) {
            return null;
        }

        return this.#responseHeaders;
    }

    getResponseHeader(name) {
        if (this.#responseHeaders.length === 0) {
            return null;
        }

        const lowerName = name.toLowerCase();
        const lines = this.#responseHeaders.split('\r\n');
        const values = [];

        for (const line of lines) {
            const colonIdx = line.indexOf(':');

            if (colonIdx === -1) {
                continue;
            }

            const key = line.substring(0, colonIdx).trim();

            if (key === lowerName) {
                const val = line.substring(colonIdx + 1).trim();

                if (val.length > 0) {
                    values.push(val);
                }
            }
        }

        return values.length > 0 ? values.join(', ') : null;
    }

    open(method, url, async = true) {
        // Reset state for reuse
        this.#readyState = XMLHttpRequest.UNSENT;
        this.#status = 0;
        this.#statusText = '';
        this.#responseURL = '';
        this.#responseHeaders = '';
        this.#responseBody = new Uint8Array(0);

        // Create a fresh HttpClient for each request
        this.#createClient();
        this[kClient].open(method, url, async);
        this.#setReadyState(XMLHttpRequest.OPENED);
    }

    overrideMimeType(_mimeType) {
        throw new TypeError('unsupported');
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
                this[kClient].sendData(new Uint8Array(buffer));
                this[kClient].sendData(null);
            });
        } else {
            this.dispatchEvent(new Event('loadstart'));

            if (payload) {
                this[kClient].sendData(payload);
            }

            this[kClient].sendData(null);
        }
    }

    setRequestHeader(name, value) {
        return this[kClient].setRequestHeader(name, value);
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
