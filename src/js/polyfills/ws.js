import { defineEventAttribute } from './event-target.js';

const core = globalThis[Symbol.for('tjs.internal.core')];
const WS = core.WebSocket;
const kWS = Symbol('kWS');
const kWsBinaryType = Symbol('kWsBinaryType');
const kWsProtocol = Symbol('kWsProtocol');
const kWsUrl = Symbol('kWsUrl');

class WebSocket extends EventTarget {
    static CONNECTING = WS.CONNECTING;
    static OPEN = WS.OPEN;
    static CLOSING = WS.CLOSING;
    static CLOSED = WS.CLOSED;
    CONNECTING = WS.CONNECTING;
    OPEN = WS.OPEN;
    CLOSING = WS.CLOSING;
    CLOSED = WS.CLOSED;

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

        ws.onclose = ev => {
            const { code, reason, wasClean } = ev;

            this.dispatchEvent(new CloseEvent('close', { code, reason, wasClean }));
        };

        ws.onerror = () => {
            this.dispatchEvent(new Event('error'));
        };

        ws.onmessage = msg => {
            let data = msg;

            if (typeof msg !== 'string' && this[kWsBinaryType] === 'blob') {
                data = new Blob([ msg ]);
            }

            this.dispatchEvent(new MessageEvent('message', data));
        };

        ws.onopen = p => {
            this[kWsProtocol] = p;
            this.dispatchEvent(new Event('open'));
        };

        this[kWS] = ws;
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
        // TODO. Not sure we can actually implement this since cws doesn't tell us
        // when the data was sent.
        return 0;
    }

    get extensions() {
        // TODO.
        return '';
    }

    get protocol() {
        return this[kWsProtocol];
    }

    get readyState() {
        return this[kWS].readyState;
    }

    get url() {
        return this[kWsUrl];
    }

    send(data) {
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

        // Looks like WebSocket implementations are very forgiving, so don't
        // throw an error here.
    }

    close(code = 1000, reason = '') {
        if (code !== 1000 && !(code >= 3000 && code <= 4999)) {
            throw new RangeError('Invalid code value');
        }

        if (reason.length > 123) {
            throw new SyntaxError('Invalid reason value');
        }

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
