import { defineEventAttribute } from './event-target.js';

const core = globalThis[Symbol.for('tjs.internal.core')];
const WS = core.WebSocket;
const kWS = Symbol('kWS');
const kWsBinaryType = Symbol('kWsBinaryType');
const kWsProtocol = Symbol('kWsProtocol');
const kWsUrl = Symbol('kWsUrl');
const kReadyState = Symbol('kReadyState');

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

    constructor(url, protocols = []) {
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

        const protocolStr = protocols.join(',') || null;

        const ws = new WS(urlStr, protocolStr);

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
