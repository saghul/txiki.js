import { defineEventAttribute } from './event-target.js';

const core = globalThis[Symbol.for('tjs.internal.core')];
const WS = core.WebSocket;
const kWS = Symbol('kWS');
const kWsBinaryType = Symbol('kWsBinaryType');
const kWsProtocol = Symbol('kWsProtocol');
const kWsUrl = Symbol('kWsUrl');
const kReadyState = Symbol('kReadyState');

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

    [kWsBinaryType] = 'blob';
    [kWsProtocol] = '';

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

        this[kWsUrl] = urlStr;

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
            this[kWsProtocol] = protocol || (protocols.length ? protocols[0] : '');
            this[kReadyState] = WebSocket.OPEN;
            this.dispatchEvent(new Event('open'));
        };

        ws.onmessage = data => {
            let msg = data;

            if (typeof data !== 'string' && this[kWsBinaryType] === 'blob') {
                msg = new Blob([ data ]);
            }

            this.dispatchEvent(new MessageEvent('message', msg));
        };

        ws.onerror = reason => {
            this.dispatchEvent(new ErrorEvent('error', { message: reason || '' }));
        };

        ws.onclose = (code, reason) => {
            this[kReadyState] = WebSocket.CLOSED;
            const wasClean = code === 1000;

            this.dispatchEvent(new CloseEvent('close', { code, reason, wasClean }));
        };

        this[kWS] = ws;
        this[kReadyState] = WebSocket.CONNECTING;
    }

    get binaryType() {
        return this[kWsBinaryType];
    }

    set binaryType(value) {
        if (![ 'arraybuffer', 'blob' ].includes(value)) {
            throw new Error(`Unsupported binaryType: ${value}`);
        }

        this[kWsBinaryType] = value;
    }

    get bufferedAmount() {
        return this[kWS].bufferedAmount;
    }

    get extensions() {
        return this[kWS].extensions;
    }

    get protocol() {
        return this[kWsProtocol];
    }

    get readyState() {
        return this[kReadyState];
    }

    get url() {
        return this[kWsUrl];
    }

    send(data) {
        if (this[kReadyState] === WebSocket.CONNECTING) {
            throw new DOMException('WebSocket is not open', 'InvalidStateError');
        }

        if (this[kReadyState] !== WebSocket.OPEN) {
            return;
        }

        if (typeof data === 'string') {
            this[kWS].sendText(data);
        } else if (data instanceof Blob) {
            data.arrayBuffer().then(buf => {
                this[kWS].sendBinary(buf, 0, buf.byteLength);
            });
        } else if (data instanceof ArrayBuffer) {
            this[kWS].sendBinary(data, 0, data.byteLength);
        } else if (ArrayBuffer.isView(data)) {
            this[kWS].sendBinary(data.buffer, data.byteOffset, data.byteLength);
        }
    }

    close(code = 1000, reason = '') {
        if (this[kReadyState] === WebSocket.CLOSING || this[kReadyState] === WebSocket.CLOSED) {
            return;
        }

        if (code !== 1000 && !(code >= 3000 && code <= 4999)) {
            throw new RangeError('Invalid code value');
        }

        if (reason.length > 123) {
            throw new SyntaxError('Invalid reason value');
        }

        this[kReadyState] = WebSocket.CLOSING;
        this[kWS].close(code, reason);
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
