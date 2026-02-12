const kWebSocket = Symbol('kWebSocket');
const kOpened = Symbol('kOpened');
const kClosed = Symbol('kClosed');
const kURL = Symbol('kURL');
const kCloseCode = Symbol('kCloseCode');
const kReason = Symbol('kReason');
const kCloseInfo = Symbol('kCloseInfo');

class WebSocketError extends DOMException {
    constructor(message = '', init = {}) {
        super(message, 'WebSocketError');

        let code = init.closeCode !== undefined ? init.closeCode : null;
        const reason = init.reason !== undefined ? String(init.reason) : '';

        if (code !== null) {
            if (code !== 1000 && !(code >= 3000 && code <= 4999)) {
                throw new DOMException(
                    `The close code must be either 1000, or between 3000 and 4999. ${code} is neither.`,
                    'InvalidAccessError'
                );
            }
        }

        if (reason) {
            const encoder = new TextEncoder();

            if (encoder.encode(reason).byteLength > 123) {
                throw new SyntaxError('reason must be no longer than 123 bytes');
            }

            if (code === null) {
                code = 1000;
            }
        }

        this[kCloseCode] = code;
        this[kReason] = reason;
    }

    get closeCode() {
        return this[kCloseCode];
    }

    get reason() {
        return this[kReason];
    }
}

function extractCloseInfo(reason) {
    if (reason instanceof WebSocketError) {
        return {
            code: reason.closeCode ?? 1000,
            reason: reason.reason
        };
    }

    return { code: 1000, reason: '' };
}

function closeWebSocket(ws, code, reason) {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        try {
            if (code !== undefined) {
                ws.close(code, reason);
            } else {
                ws.close();
            }
        } catch (_) {
            // Ignored.
        }
    }
}

class WebSocketStream {
    constructor(url, options = {}) {
        let urlStr;

        try {
            urlStr = new URL(url).toString();
        } catch (_) {
            // Ignore, will throw right after.
        }

        if (!urlStr) {
            throw new DOMException(`The URL '${url}' is not valid.`, 'SyntaxError');
        }

        this[kURL] = urlStr;

        const protocols = options.protocols || [];
        const signal = options.signal;

        if (signal && signal.aborted) {
            const error = signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');

            this[kOpened] = Promise.reject(error);
            this[kClosed] = Promise.reject(error);
            this[kOpened].catch(() => {});
            this[kClosed].catch(() => {});

            return;
        }

        const opened = Promise.withResolvers();
        const closed = Promise.withResolvers();
        let openedSettled = false;
        let closedSettled = false;
        let hadError = false;

        this[kOpened] = opened.promise;
        this[kClosed] = closed.promise;

        const ws = new WebSocket(urlStr, protocols);

        ws.binaryType = 'arraybuffer';
        this[kWebSocket] = ws;
        this[kCloseInfo] = null;

        const self = this;

        let readableController;
        let writableController;

        const readable = new ReadableStream({
            start(controller) {
                readableController = controller;
            },
            cancel(reason) {
                const info = extractCloseInfo(reason);

                self[kCloseInfo] = { closeCode: info.code, reason: info.reason };
                closeWebSocket(ws, info.code, info.reason);
            }
        });

        const writable = new WritableStream({
            start(controller) {
                writableController = controller;
            },
            write(chunk) {
                if (ws.readyState !== WebSocket.OPEN) {
                    throw new TypeError('WebSocket is not open');
                }

                ws.send(chunk);
            },
            close() {
                closeWebSocket(ws);
            },
            abort(reason) {
                const info = extractCloseInfo(reason);

                self[kCloseInfo] = { closeCode: info.code, reason: info.reason };
                closeWebSocket(ws, info.code, info.reason);
            }
        });

        // Helper to clean up the abort signal listener.
        let onAbort;

        function removeAbortListener() {
            if (signal && onAbort) {
                signal.removeEventListener('abort', onAbort);
                onAbort = null;
            }
        }

        ws.addEventListener('open', () => {
            if (openedSettled) {
                return;
            }

            openedSettled = true;
            removeAbortListener();
            opened.resolve({
                readable,
                writable,
                extensions: ws.extensions || '',
                protocol: ws.protocol || ''
            });
        });

        ws.addEventListener('message', event => {
            try {
                if (typeof event.data === 'string') {
                    readableController.enqueue(event.data);
                } else {
                    readableController.enqueue(new Uint8Array(event.data));
                }
            } catch (_) {
                // Stream already closed or errored.
            }
        });

        ws.addEventListener('error', event => {
            hadError = true;

            const msg = event.message ? `WebSocket error: ${event.message}` : 'WebSocket error';

            if (!openedSettled) {
                openedSettled = true;
                opened.reject(new WebSocketError(msg));
            }

            removeAbortListener();
        });

        ws.addEventListener('close', event => {
            removeAbortListener();

            const code = event.code;
            const reason = event.reason || '';
            const validCode = code === 1000 || (code >= 3000 && code <= 4999);
            const wsError = new WebSocketError('', validCode ? { closeCode: code, reason } : {});

            if (!openedSettled) {
                // Connection never established.
                openedSettled = true;
                opened.reject(wsError);

                if (!closedSettled) {
                    closedSettled = true;
                    closed.reject(wsError);
                }

                try {
                    readableController.error(wsError);
                } catch (_) {
                    // Already closed or errored.
                }

                try {
                    writableController.error(wsError);
                } catch (_) {
                    // Already closed or errored.
                }

                return;
            }

            if (hadError) {
                // Unclean close: error both streams, reject closed.
                try {
                    readableController.error(wsError);
                } catch (_) {
                    // Already closed or errored.
                }

                try {
                    writableController.error(wsError);
                } catch (_) {
                    // Already closed or errored.
                }

                if (!closedSettled) {
                    closedSettled = true;
                    closed.reject(wsError);
                }
            } else {
                // Clean close: close readable, error writable, resolve closed.
                try {
                    readableController.close();
                } catch (_) {
                    // Already closed or errored.
                }

                try {
                    writableController.error(new DOMException('WebSocket closed', 'InvalidStateError'));
                } catch (_) {
                    // Already closed or errored.
                }

                if (!closedSettled) {
                    closedSettled = true;
                    // Use the close info we explicitly sent rather than what the
                    // server echoed back, since server behavior varies across
                    // platforms. When no code was sent, report 1005 (No Status).
                    const info = self[kCloseInfo];

                    closed.resolve({
                        closeCode: info ? info.closeCode : 1005,
                        reason: info ? info.reason : ''
                    });
                }
            }
        });

        if (signal) {
            onAbort = () => {
                const error = signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');

                if (!openedSettled) {
                    openedSettled = true;
                    opened.reject(error);
                }

                closeWebSocket(ws, 1000, '');

                try {
                    readableController.error(error);
                } catch (_) {
                    // Already closed or errored.
                }

                try {
                    writableController.error(error);
                } catch (_) {
                    // Already closed or errored.
                }

                if (!closedSettled) {
                    closedSettled = true;
                    closed.reject(error);
                }
            };

            signal.addEventListener('abort', onAbort, { once: true });
        }
    }

    get url() {
        return this[kURL];
    }

    get opened() {
        return this[kOpened];
    }

    get closed() {
        return this[kClosed];
    }

    close(options = {}) {
        let closeCode = options.closeCode;
        const reason = options.reason || '';

        if (closeCode !== undefined) {
            if (closeCode !== 1000 && !(closeCode >= 3000 && closeCode <= 4999)) {
                throw new DOMException(
                    `The close code must be either 1000, or between 3000 and 4999. ${closeCode} is neither.`,
                    'InvalidAccessError'
                );
            }
        }

        if (reason) {
            const encoder = new TextEncoder();

            if (encoder.encode(reason).byteLength > 123) {
                throw new DOMException('reason must be no longer than 123 bytes', 'SyntaxError');
            }

            if (closeCode === undefined) {
                closeCode = 1000;
            }
        }

        const ws = this[kWebSocket];

        if (!ws) {
            return;
        }

        if (closeCode !== undefined) {
            this[kCloseInfo] = { closeCode, reason };
            closeWebSocket(ws, closeCode, reason);
        } else {
            closeWebSocket(ws, undefined, undefined);
        }
    }
}

Object.defineProperty(window, 'WebSocketError', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: WebSocketError
});

Object.defineProperty(window, 'WebSocketStream', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: WebSocketStream
});
