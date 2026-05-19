import core from 'tjs:internal/core';

import { defineEventAttribute } from './event-target.js';

const WS = core.WebSocket;

const FORBIDDEN_HEADERS = new Set([
    'connection',
    'upgrade',
    'host',
    'sec-websocket-accept',
    'sec-websocket-extensions',
    'sec-websocket-key',
    'sec-websocket-protocol',
    'sec-websocket-version',
]);

function validateHeaderName(name) {
    if (typeof name !== 'string' || name.length === 0) {
        throw new TypeError('Header name must be a non-empty string');
    }

    if (/[^\t\x20-\x7e]/.test(name)) {
        throw new TypeError(`Invalid header name: "${name}"`);
    }

    if (FORBIDDEN_HEADERS.has(name.toLowerCase())) {
        throw new TypeError(`Forbidden header name: "${name}"`);
    }
}

function validateHeaderValue(value) {
    if (typeof value !== 'string') {
        throw new TypeError('Header value must be a string');
    }

    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x08\x0a-\x1f\x7f]/.test(value)) {
        throw new TypeError(`Invalid header value: "${value}"`);
    }
}

function parseHeaders(headers) {
    const result = [];

    if (headers instanceof Headers) {
        headers.forEach((value, name) => {
            result.push([ name, value ]);
        });
    } else if (Array.isArray(headers)) {
        for (const entry of headers) {
            if (!Array.isArray(entry) || entry.length !== 2) {
                throw new TypeError('Header entries must be [name, value] pairs');
            }

            result.push([ String(entry[0]), String(entry[1]) ]);
        }
    } else if (headers !== null && typeof headers === 'object') {
        for (const [ name, value ] of Object.entries(headers)) {
            result.push([ name, String(value) ]);
        }
    } else {
        throw new TypeError('headers must be an object, Headers instance, or array of entries');
    }

    return result;
}

class WebSocket extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    CONNECTING = 0;
    OPEN = 1;
    CLOSING = 2;
    CLOSED = 3;

    #ws;
    #binaryType = 'blob';
    #protocol = '';
    #url;
    #readyState;

    constructor(url, protocolsOrOptions = []) {
        super();

        let urlStr;

        try {
            urlStr = new URL(url).toString();
        } catch (_) {
            // Ignore, will throw right after.
        }

        if (!urlStr) {
            throw new Error('Invalid URL');
        }

        this.#url = urlStr;

        let protocols;
        let headers;

        if (typeof protocolsOrOptions === 'string') {
            protocols = [ protocolsOrOptions ];
        } else if (Array.isArray(protocolsOrOptions)) {
            protocols = protocolsOrOptions;
        } else if (protocolsOrOptions !== null && typeof protocolsOrOptions === 'object') {
            protocols = protocolsOrOptions.protocols || [];
            headers = protocolsOrOptions.headers;
        } else {
            protocols = [];
        }

        const protocolStr = protocols.join(',') || null;

        let headerNames = null;
        let headerValues = null;

        if (headers !== undefined && headers !== null) {
            const entries = parseHeaders(headers);

            headerNames = [];
            headerValues = [];

            for (const [ name, value ] of entries) {
                validateHeaderName(name);
                validateHeaderValue(value);
                headerNames.push(name + ':');
                headerValues.push(value);
            }
        }

        const ws = new WS(urlStr, protocolStr, headerNames, headerValues);

        ws.onopen = protocol => {
            this.#protocol = protocol || '';
            this.#readyState = WebSocket.OPEN;
            this.dispatchEvent(new Event('open'));
        };

        ws.onmessage = data => {
            let msg = data;

            if (typeof data !== 'string' && this.#binaryType === 'blob') {
                msg = new Blob([ data ]);
            }

            this.dispatchEvent(new MessageEvent('message', msg));
        };

        ws.onerror = reason => {
            this.dispatchEvent(new ErrorEvent('error', { message: reason || '' }));
        };

        ws.onclose = (code, reason) => {
            this.#readyState = WebSocket.CLOSED;
            const wasClean = code === 1000;

            this.dispatchEvent(new CloseEvent('close', { code, reason, wasClean }));
        };

        this.#ws = ws;
        this.#readyState = WebSocket.CONNECTING;
    }

    get binaryType() {
        return this.#binaryType;
    }

    set binaryType(value) {
        if (![ 'arraybuffer', 'blob' ].includes(value)) {
            throw new Error(`Unsupported binaryType: ${value}`);
        }

        this.#binaryType = value;
    }

    get bufferedAmount() {
        return this.#ws.bufferedAmount;
    }

    get extensions() {
        return this.#ws.extensions;
    }

    get protocol() {
        return this.#protocol;
    }

    get readyState() {
        return this.#readyState;
    }

    get url() {
        return this.#url;
    }

    send(data) {
        if (this.#readyState === WebSocket.CONNECTING) {
            throw new DOMException('WebSocket is not open', 'InvalidStateError');
        }

        if (this.#readyState !== WebSocket.OPEN) {
            return;
        }

        if (typeof data === 'string') {
            this.#ws.sendText(data);
        } else if (data instanceof Blob) {
            data.arrayBuffer().then(buf => {
                this.#ws.sendBinary(buf);
            });
        } else if (data instanceof ArrayBuffer) {
            this.#ws.sendBinary(data);
        } else if (ArrayBuffer.isView(data)) {
            this.#ws.sendBinary(data.buffer, data.byteOffset, data.byteLength);
        }
    }

    close(code = 1000, reason = '') {
        if (this.#readyState === WebSocket.CLOSING || this.#readyState === WebSocket.CLOSED) {
            return;
        }

        if (code !== 1000 && !(code >= 3000 && code <= 4999)) {
            throw new RangeError('Invalid code value');
        }

        if (reason.length > 123) {
            throw new SyntaxError('Invalid reason value');
        }

        this.#readyState = WebSocket.CLOSING;
        this.#ws.close(code, reason);
    }
}

const xhrProto = WebSocket.prototype;

defineEventAttribute(xhrProto, 'close');
defineEventAttribute(xhrProto, 'error');
defineEventAttribute(xhrProto, 'message');
defineEventAttribute(xhrProto, 'open');

Object.defineProperty(window, 'WebSocket', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: WebSocket
});
