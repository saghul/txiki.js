// A TLS server that speaks just enough HTTP/2 to answer GETs on one connection
// with a headers-only 200, so tests can control frames tjs.serve never sends.
//
// settings: payload of the server's SETTINGS frame, as [id, value] pairs.
// responseDelayMs: how long to hold a response after its request arrives.
// pingAfterResponse: send a PING in the same write as each response, so it is
// the last frame the client parses before its next request.

import cert from '../fixtures/server-cert.pem' with { type: 'text' };
import key from '../fixtures/server-key.pem' with { type: 'text' };

const CLIENT_PREFACE_LEN = 24;
const TYPE_HEADERS = 0x1;
const TYPE_SETTINGS = 0x4;
const TYPE_PING = 0x6;
const FLAG_ACK = 0x1;
const FLAG_END_STREAM = 0x1;
const FLAG_END_HEADERS = 0x4;
const STATUS_200 = 0x88; // HPACK static table entry 8, ":status: 200"

function frame(type, flags, sid, payload = new Uint8Array(0)) {
    const buf = new Uint8Array(9 + payload.length);
    const view = new DataView(buf.buffer);

    view.setUint32(0, payload.length << 8);
    buf[3] = type;
    buf[4] = flags;
    view.setUint32(5, sid);
    buf.set(payload, 9);

    return buf;
}

function settingsPayload(settings) {
    const buf = new Uint8Array(settings.length * 6);
    const view = new DataView(buf.buffer);

    settings.forEach(([ id, value ], i) => {
        view.setUint16(i * 6, id);
        view.setUint32(i * 6 + 2, value);
    });

    return buf;
}

function concat(...parts) {
    const buf = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let off = 0;

    for (const p of parts) {
        buf.set(p, off);
        off += p.length;
    }

    return buf;
}

export async function createRawH2Server({ settings = [], responseDelayMs = 0, pingAfterResponse = false } = {}) {
    const server = await tjs.listen('tls', '127.0.0.1', 0, { cert, key, alpn: [ 'h2' ] });
    const { readable: acceptStream, localPort: port } = await server.opened;
    const requestSid = Promise.withResolvers();
    const requestSids = [];

    (async () => {
        const { value: conn } = await acceptStream.getReader().read();
        const { readable, writable } = await conn.opened;
        const reader = readable.getReader();
        const writer = writable.getWriter();
        let buf = new Uint8Array(0);
        let prefaceSeen = false;

        await writer.write(frame(TYPE_SETTINGS, 0, 0, settingsPayload(settings)));

        try {
            while (true) {
                const { value, done } = await reader.read();

                if (done) {
                    break;
                }

                const merged = new Uint8Array(buf.length + value.length);

                merged.set(buf);
                merged.set(value, buf.length);
                buf = merged;

                if (!prefaceSeen) {
                    if (buf.length < CLIENT_PREFACE_LEN) {
                        continue;
                    }

                    buf = buf.subarray(CLIENT_PREFACE_LEN);
                    prefaceSeen = true;
                }

                while (buf.length >= 9) {
                    const len = (buf[0] << 16) | (buf[1] << 8) | buf[2];

                    if (buf.length < 9 + len) {
                        break;
                    }

                    const type = buf[3];
                    const flags = buf[4];
                    const sid = new DataView(buf.buffer, buf.byteOffset + 5, 4).getUint32(0) & 0x7fffffff;

                    buf = buf.subarray(9 + len);

                    if (type === TYPE_SETTINGS && !(flags & FLAG_ACK)) {
                        await writer.write(frame(TYPE_SETTINGS, FLAG_ACK, 0));
                    } else if (type === TYPE_HEADERS) {
                        requestSid.resolve(sid);
                        requestSids.push(sid);

                        if (responseDelayMs) {
                            await new Promise(resolve => setTimeout(resolve, responseDelayMs));
                        }

                        const response = frame(TYPE_HEADERS, FLAG_END_HEADERS | FLAG_END_STREAM, sid,
                            new Uint8Array([ STATUS_200 ]));

                        await writer.write(pingAfterResponse ?
                            concat(response, frame(TYPE_PING, 0, 0, new Uint8Array(8))) : response);
                    }
                }
            }
        } catch {
            // The client may drop the connection first.
        } finally {
            conn.close();
        }
    })();

    return { port, requestSid: requestSid.promise, requestSids, close: () => server.close() };
}
