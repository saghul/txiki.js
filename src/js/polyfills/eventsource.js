// WHATWG EventSource (Server-Sent Events), implemented on top of streaming fetch().
// https://html.spec.whatwg.org/multipage/server-sent-events.html

import { defineEventAttribute } from './event-target.js';

const DEFAULT_RECONNECT_TIME = 3000;

class EventSource extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 2;
    CONNECTING = 0;
    OPEN = 1;
    CLOSED = 2;

    #url;
    #withCredentials;
    #readyState;

    // The per-connection abort controller; close() aborts it and sets readyState
    // to CLOSED, so any resulting AbortError is always terminal (never reconnects).
    #abortController = null;
    #reconnectTimer = null;
    #reconnectTime = DEFAULT_RECONNECT_TIME;

    // Origin of the last successful response, used for MessageEvent.origin.
    #origin = '';

    // SSE parser state. #buffer holds an incomplete trailing line across chunks;
    // #dataBuffer and #eventTypeBuffer accumulate the event currently being parsed.
    // The spec's "last event ID buffer" (#lastEventIdBuffer) is set as soon as an
    // id: field is parsed, but the "last event ID string" (#lastEventId) — what the
    // Last-Event-ID reconnect header and MessageEvent.lastEventId use — is only
    // committed from it at dispatch time, so a mid-event disconnect resumes from
    // the last *dispatched* id. Both persist across events and reconnections.
    #buffer = '';
    #dataBuffer = '';
    #eventTypeBuffer = '';
    #lastEventId = '';
    #lastEventIdBuffer = '';

    constructor(url, options = {}) {
        super();

        let urlRecord;

        try {
            urlRecord = new URL(url);
        } catch (_) {
            throw new DOMException(`Cannot open an EventSource to '${url}'.`, 'SyntaxError');
        }

        this.#url = urlRecord.href;
        this.#withCredentials = Boolean(options?.withCredentials);
        this.#readyState = EventSource.CONNECTING;

        // Start connecting asynchronously so the caller can attach listeners
        // first. #connect handles its own errors; the catch is a safety net so a
        // stray rejection from this fire-and-forget call can never abort the runtime.
        queueMicrotask(() => this.#connect().catch(() => {}));
    }

    get url() {
        return this.#url;
    }

    get withCredentials() {
        return this.#withCredentials;
    }

    get readyState() {
        return this.#readyState;
    }

    close() {
        this.#readyState = EventSource.CLOSED;

        if (this.#abortController) {
            this.#abortController.abort();
        }

        if (this.#reconnectTimer !== null) {
            clearTimeout(this.#reconnectTimer);
            this.#reconnectTimer = null;
        }
    }

    async #connect() {
        if (this.#readyState === EventSource.CLOSED) {
            return;
        }

        // Fresh parse state for each connection; the incomplete line from a dropped
        // connection must not leak into the next one. The id buffer resets to the
        // committed string, discarding any id parsed but not yet dispatched before
        // the drop (which is exactly what Last-Event-ID already resumed from).
        this.#buffer = '';
        this.#dataBuffer = '';
        this.#eventTypeBuffer = '';
        this.#lastEventIdBuffer = this.#lastEventId;

        const controller = new AbortController();

        this.#abortController = controller;

        const headers = {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
        };

        if (this.#lastEventId !== '') {
            headers['Last-Event-ID'] = this.#lastEventId;
        }

        let response;

        try {
            response = await fetch(this.#url, {
                headers,
                signal: controller.signal,
                redirect: 'follow',
            });
        } catch (_) {
            // Network error, connection refused, or aborted by close(). Reconnect
            // unless close() ran (checked inside #reconnect).
            this.#reconnect();

            return;
        }

        // close() may have run while awaiting the response; bail before validating
        // so no spurious error/open event fires after CLOSED.
        if (this.#readyState === EventSource.CLOSED) {
            await this.#cancelBody(response);

            return;
        }

        // Validate: status 200 and Content-Type essence text/event-stream. Anything
        // else fails the connection permanently (no reconnect).
        const mime = (response.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();

        if (response.status !== 200 || mime !== 'text/event-stream') {
            await this.#cancelBody(response);
            this.#failConnection();

            return;
        }

        this.#readyState = EventSource.OPEN;

        try {
            this.#origin = new URL(response.url).origin;
        } catch (_) {
            this.#origin = new URL(this.#url).origin;
        }

        this.dispatchEvent(new Event('open'));

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                this.#feed(value);

                if (this.#readyState === EventSource.CLOSED) {
                    break;
                }
            }
        } catch (_) {
            // Stream errored (network drop or aborted by close()).
        }

        // The stream ended or errored: reconnect unless close() ran.
        this.#reconnect();
    }

    async #cancelBody(response) {
        try {
            await response.body?.cancel();
        } catch (_) {
            // Already errored/closed.
        }
    }

    #reconnect() {
        if (this.#readyState === EventSource.CLOSED) {
            return;
        }

        this.#readyState = EventSource.CONNECTING;
        this.dispatchEvent(new Event('error'));

        // A listener may have called close() while handling the error event.
        if (this.#readyState === EventSource.CLOSED) {
            return;
        }

        this.#reconnectTimer = setTimeout(() => {
            this.#reconnectTimer = null;

            if (this.#readyState === EventSource.CLOSED) {
                return;
            }

            this.#connect().catch(() => {});
        }, this.#reconnectTime);
    }

    #failConnection() {
        if (this.#readyState === EventSource.CLOSED) {
            return;
        }

        this.#readyState = EventSource.CLOSED;
        this.dispatchEvent(new Event('error'));
    }

    // Incremental line splitter. Accepts \r\n, \n and \r as terminators, holding a
    // trailing lone \r until the next chunk (it may be the start of a \r\n pair).
    #feed(chunk) {
        this.#buffer += chunk;

        const buffer = this.#buffer;
        const len = buffer.length;
        let pos = 0;
        let lineStart = 0;

        while (pos < len) {
            const c = buffer.charCodeAt(pos);

            if (c === 0x0a) {
                this.#processLine(buffer.slice(lineStart, pos));
                pos += 1;
                lineStart = pos;
            } else if (c === 0x0d) {
                if (pos === len - 1) {
                    // Trailing \r: wait for the next chunk to disambiguate \r vs \r\n.
                    break;
                }

                this.#processLine(buffer.slice(lineStart, pos));
                pos += buffer.charCodeAt(pos + 1) === 0x0a ? 2 : 1;
                lineStart = pos;
            } else {
                pos += 1;
            }
        }

        this.#buffer = buffer.slice(lineStart);
    }

    #processLine(line) {
        if (line === '') {
            this.#dispatchMessage();

            return;
        }

        if (line.charCodeAt(0) === 0x3a) {
            // Comment (keep-alive), ignore.
            return;
        }

        const colon = line.indexOf(':');
        let field;
        let value;

        if (colon === -1) {
            field = line;
            value = '';
        } else {
            field = line.slice(0, colon);
            value = line.slice(colon + 1);

            if (value.charCodeAt(0) === 0x20) {
                value = value.slice(1);
            }
        }

        this.#processField(field, value);
    }

    #processField(field, value) {
        switch (field) {
            case 'event':
                this.#eventTypeBuffer = value;
                break;
            case 'data':
                this.#dataBuffer += value + '\n';
                break;
            case 'id':
                // Set the buffer; it is committed to #lastEventId only at dispatch.
                // Ignore values containing a NUL, per spec.
                if (!value.includes('\u0000')) {
                    this.#lastEventIdBuffer = value;
                }

                break;
            case 'retry':
                if (/^[0-9]+$/.test(value)) {
                    this.#reconnectTime = parseInt(value, 10);
                }

                break;
            default:
                // Unknown field, ignore.
                break;
        }
    }

    #dispatchMessage() {
        // Commit the id buffer to the last event ID string (spec dispatch step 1),
        // even when this block carries no data and dispatches nothing.
        this.#lastEventId = this.#lastEventIdBuffer;

        if (this.#dataBuffer === '') {
            // No data: reset the event type buffer and dispatch nothing.
            this.#eventTypeBuffer = '';

            return;
        }

        let data = this.#dataBuffer;

        // Strip the trailing newline added by the last data field.
        if (data.charCodeAt(data.length - 1) === 0x0a) {
            data = data.slice(0, -1);
        }

        const type = this.#eventTypeBuffer || 'message';

        this.#dataBuffer = '';
        this.#eventTypeBuffer = '';

        // A prior listener may have called close() while dispatching this batch.
        if (this.#readyState === EventSource.CLOSED) {
            return;
        }

        this.dispatchEvent(new MessageEvent(type, {
            data,
            origin: this.#origin,
            lastEventId: this.#lastEventId,
        }));
    }
}

const proto = EventSource.prototype;

defineEventAttribute(proto, 'open');
defineEventAttribute(proto, 'message');
defineEventAttribute(proto, 'error');

Object.defineProperty(globalThis, 'EventSource', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: EventSource
});
