import { defineEventAttribute } from './event-target.js';
import { HttpClient } from './http-client.js';
const kClient = Symbol('kClient');


function statusTextForCode(code) {
    switch (code) {
        case 100: return 'Continue';
        case 101: return 'Switching Protocols';
        case 200: return 'OK';
        case 201: return 'Created';
        case 202: return 'Accepted';
        case 204: return 'No Content';
        case 206: return 'Partial Content';
        case 301: return 'Moved Permanently';
        case 302: return 'Found';
        case 303: return 'See Other';
        case 304: return 'Not Modified';
        case 307: return 'Temporary Redirect';
        case 308: return 'Permanent Redirect';
        case 400: return 'Bad Request';
        case 401: return 'Unauthorized';
        case 403: return 'Forbidden';
        case 404: return 'Not Found';
        case 405: return 'Method Not Allowed';
        case 408: return 'Request Timeout';
        case 409: return 'Conflict';
        case 410: return 'Gone';
        case 413: return 'Payload Too Large';
        case 415: return 'Unsupported Media Type';
        case 429: return 'Too Many Requests';
        case 500: return 'Internal Server Error';
        case 502: return 'Bad Gateway';
        case 503: return 'Service Unavailable';
        case 504: return 'Gateway Timeout';
        default: return '';
    }
}


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
    #contentLength = -1;
    #responseType = '';
    #timeout = 0;
    #withCredentials = false;
    #method = '';
    #url = '';

    constructor() {
        super();
        this[kClient] = null;
    }

    #createClient() {
        const client = new HttpClient();

        client.onstatus = status => {
            this.#status = status;
            this.#statusText = statusTextForCode(status);
        };

        client.onurl = url => {
            this.#responseURL = url;
        };

        client.onheader = (name, value) => {
            const lname = name.toLowerCase();

            this.#responseHeaders += lname + ': ' + value + '\r\n';

            if (lname === 'content-length') {
                this.#contentLength = parseInt(value, 10);
            }
        };

        client.onheadersend = () => {
            this.#setReadyState(XMLHttpRequest.HEADERS_RECEIVED);
        };

        client.ondata = chunk => {
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

            const lengthComputable = this.#contentLength > 0;

            this.dispatchEvent(new ProgressEvent('progress', {
                lengthComputable,
                loaded: this.#responseBody.length,
                total: lengthComputable ? this.#contentLength : 0
            }));
        };

        client.oncomplete = error => {
            if (error && error === 'ABORTED') {
                this.#readyState = XMLHttpRequest.UNSENT;
                this.#status = 0;
                this.#statusText = '';
                this.dispatchEvent(new Event('abort'));
            } else {
                this.#setReadyState(XMLHttpRequest.DONE);

                if (error) {
                    if (error === 'TIMED_OUT') {
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

        client.setEnableCookies(this.withCredentials);

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
        this.#withCredentials = !!value;
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
        if (async === false) {
            throw new TypeError('Synchronous XHR is not supported');
        }

        // Reset state for reuse
        this.#readyState = XMLHttpRequest.UNSENT;
        this.#status = 0;
        this.#statusText = '';
        this.#responseURL = '';
        this.#responseHeaders = '';
        this.#responseBody = new Uint8Array(0);
        this.#contentLength = -1;
        this.#method = method;
        this.#url = url;

        // Create a fresh HttpClient for each request
        this.#createClient();
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
                this[kClient].open(this.#method, this.#url, new Uint8Array(buffer));
            });
        } else {
            this.dispatchEvent(new Event('loadstart'));
            this[kClient].open(this.#method, this.#url, payload);
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
