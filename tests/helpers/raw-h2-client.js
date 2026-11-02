// A TLS client that speaks just enough HTTP/2 to send one request with a body
// framed only by DATA frames (no content-length), which fetch never sends.
//
// steps: what follows the HEADERS, in order: a string or Uint8Array is a DATA
// frame, a number is a pause in ms, 'end' is an empty DATA frame with
// END_STREAM, 'reset' is RST_STREAM (CANCEL), a function is awaited. Without
// steps the HEADERS carry END_STREAM (an empty body).
// Resolves with the response body text once the response ends, or null if the
// stream or the connection is closed without one (always, after a 'reset').

import { frame } from './raw-h2-server.js';

const PREFACE = new TextEncoder().encode('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n');
const TYPE_DATA = 0x0;
const TYPE_HEADERS = 0x1;
const TYPE_RST_STREAM = 0x3;
const TYPE_SETTINGS = 0x4;
const TYPE_GOAWAY = 0x7;
const FLAG_ACK = 0x1;
const FLAG_END_STREAM = 0x1;
const FLAG_END_HEADERS = 0x4;
const SID = 1;

const h2frame = (type, flags, payload) => frame(type, flags, type === TYPE_SETTINGS ? 0 : SID, payload);

// HPACK "literal header field without indexing", name from the static table.
function literal(nameIndex, value) {
    const v = new TextEncoder().encode(value);

    return [ nameIndex, v.length, ...v ];
}

export async function rawH2Request(port, method, path, steps = []) {
    const conn = await tjs.connect('tls', '127.0.0.1', port, { alpn: [ 'h2' ], verifyPeer: false });
    const { readable, writable } = await conn.opened;
    const writer = writable.getWriter();
    const block = new Uint8Array([
        ...literal(2, method), // :method
        0x87, // :scheme https
        ...literal(4, path), // :path
        ...literal(1, `127.0.0.1:${port}`), // :authority
    ]);
    const headersFlags = FLAG_END_HEADERS | (steps.length ? 0 : FLAG_END_STREAM);

    await writer.write(PREFACE);
    await writer.write(h2frame(TYPE_SETTINGS, 0));
    await writer.write(h2frame(TYPE_HEADERS, headersFlags, block));

    const response = (async () => {
        const reader = readable.getReader();
        const decoder = new TextDecoder();
        let buf = new Uint8Array(0);
        let body = '';

        while (true) {
            const { value, done } = await reader.read();

            if (done) {
                return null;
            }

            const merged = new Uint8Array(buf.length + value.length);

            merged.set(buf);
            merged.set(value, buf.length);
            buf = merged;

            while (buf.length >= 9) {
                const len = (buf[0] << 16) | (buf[1] << 8) | buf[2];

                if (buf.length < 9 + len) {
                    break;
                }

                const type = buf[3];
                const flags = buf[4];
                const payload = buf.subarray(9, 9 + len);

                buf = buf.subarray(9 + len);

                if (type === TYPE_SETTINGS && !(flags & FLAG_ACK)) {
                    await writer.write(h2frame(TYPE_SETTINGS, FLAG_ACK));
                } else if (type === TYPE_DATA) {
                    body += decoder.decode(payload, { stream: true });
                } else if (type === TYPE_RST_STREAM || type === TYPE_GOAWAY) {
                    return null;
                }

                if ((type === TYPE_DATA || type === TYPE_HEADERS) && (flags & FLAG_END_STREAM)) {
                    return body;
                }
            }
        }
    })().catch(() => null);

    for (const step of steps) {
        if (typeof step === 'function') {
            await step();
        } else if (typeof step === 'number') {
            await new Promise(resolve => setTimeout(resolve, step));
        } else if (step === 'end') {
            await writer.write(h2frame(TYPE_DATA, FLAG_END_STREAM));
        } else if (step === 'reset') {
            await writer.write(h2frame(TYPE_RST_STREAM, 0, new Uint8Array([ 0, 0, 0, 0x8 ])));
        } else {
            await writer.write(h2frame(TYPE_DATA, 0, typeof step === 'string' ? new TextEncoder().encode(step) : step));
        }
    }

    try {
        return steps.includes('reset') ? null : await response;
    } finally {
        conn.close();
    }
}
