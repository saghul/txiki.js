import core from 'tjs:internal/core';
const HttpServer = core.HttpServer;

// Hop-by-hop headers managed by lws; must not be passed through for streaming responses.
const kHopByHopHeaders = new Set([ 'transfer-encoding', 'connection', 'content-length', 'keep-alive' ]);

// Pending WebSocket upgrade IDs are attached to the Request handed to the user.
// Request is a foreign class we don't own, so a WeakMap is used rather than a
// `#private` field on a wrapper.
const wsUpgrades = new WeakMap();

// Native error message prefixes; must match src/httpserver.c.
const kQuicListenerError = 'failed to create HTTP/3 (QUIC) listener';
const kVhostError = 'failed to create HTTP server vhost';

const kH3MaxAttempts = 16;
const kDynamicPortMin = 49152;
const kDynamicPortMax = 65535;

// With http3 and port 0 the OS picks the TCP port and the QUIC listener must
// bind UDP on that same number, which can fail (the UDP port is taken, or on
// Windows sits in an excluded port range). Port 0 would keep handing out nearby
// ports, so retry on random ports from the dynamic range instead.
function createHandle(opts) {
    if (!opts.http3 || opts.port !== 0) {
        return new HttpServer(opts);
    }

    for (let attempt = 1; ; attempt++) {
        try {
            return new HttpServer(opts);
        } catch (e) {
            const msg = String(e?.message);
            const retryable = msg.startsWith(kQuicListenerError) || (opts.port !== 0 && msg.startsWith(kVhostError));

            if (!retryable || attempt >= kH3MaxAttempts) {
                throw e;
            }

            opts.port = kDynamicPortMin + Math.floor(Math.random() * (kDynamicPortMax - kDynamicPortMin + 1));
        }
    }
}

class Server {
    #handle;
    #handler;
    #isTLS;
    #closed = false;
    #closedPromise;
    #streamControllers = new Map();
    #responseReaders = new Map();

    constructor(options) {
        if (typeof options === 'function') {
            options = { fetch: options };
        }

        const { fetch: handler, port = 0, listenIp = '0.0.0.0', websocket, tls, http3 = false } = options;

        if (typeof handler !== 'function') {
            throw new TypeError('fetch handler must be a function');
        }

        this.#handler = handler;

        const { promise, resolve } = Promise.withResolvers();

        this.#closedPromise = promise;

        let certPem = null;
        let keyPem = null;
        let caPem = null;
        let passphrase = null;
        let requestCert = false;
        let alpn = null;

        if (tls) {
            if (typeof tls.cert !== 'string' || typeof tls.key !== 'string') {
                throw new TypeError('tls.cert and tls.key must be strings containing PEM data');
            }

            certPem = tls.cert;
            keyPem = tls.key;
            caPem = tls.ca ?? null;
            passphrase = tls.passphrase ?? null;
            requestCert = !!tls.requestCert;

            // Optional ALPN protocol list to advertise (string or array),
            // e.g. 'h2' to require HTTP/2. Defaults to lws's "h2,http/1.1".
            if (tls.alpn) {
                alpn = Array.isArray(tls.alpn) ? tls.alpn.join(',') : tls.alpn;
            }
        }

        // Also serve HTTP/3 over QUIC (UDP) on the same port; the TCP vhost
        // advertises it to clients via an Alt-Svc header. QUIC is always
        // TLS 1.3, so it needs the tls option.
        if (http3 && !tls) {
            throw new TypeError('http3 requires the tls option (cert and key)');
        }

        this.#isTLS = !!tls;

        const onRequest = (
            requestId, method, url, headersArr, bodyBuffer, remoteAddr, isWsUpgrade, isStreaming, httpVersion,
        ) => {
            if (isWsUpgrade) {
                this.#handleWsUpgrade(requestId, method, url, headersArr, remoteAddr);
            } else {
                this.#handleRequest(
                    requestId, method, url, headersArr, bodyBuffer, remoteAddr, isStreaming, httpVersion,
                );
            }
        };

        const onBodyChunk = (requestId, chunk) => {
            const controller = this.#streamControllers.get(requestId);

            if (!controller) {
                return;
            }

            if (chunk) {
                controller.enqueue(new Uint8Array(chunk));
            } else {
                controller.close();
                this.#streamControllers.delete(requestId);
            }
        };

        this.#handle = createHandle({
            port,
            listenIp,
            onRequest,
            onBodyChunk,
            // Runs inside an lws close callback, so the body's cancel() (user code)
            // is deferred to a later event-loop turn.
            onRequestClose: requestId => {
                const reader = this.#responseReaders.get(requestId);

                if (reader) {
                    setTimeout(() => Server.#cancelReader(reader), 0);
                }
            },
            // onClose runs inside lws's vhost teardown (PROTOCOL_DESTROY). Resolving
            // there would run the awaiting code, which may create a new server,
            // re-entrantly inside lws, so resolve on a later event-loop turn.
            onClose: () => setTimeout(resolve, 0),
            wsOpen: websocket?.open ?? null,
            wsMessage: websocket?.message ?? null,
            wsClose: websocket?.close ?? null,
            wsError: websocket?.error ?? null,
            certPem,
            keyPem,
            caPem,
            passphrase,
            requestCert,
            alpn,
            http3: !!http3,
        });
    }

    get port() {
        return this.#handle.port;
    }

    async close() {
        if (!this.#closed) {
            this.#closed = true;
            this.#handle.close();

            // The native callbacks are released now, so cancel in-flight response
            // bodies here: one whose pull() never settles would otherwise never stop.
            for (const reader of this.#responseReaders.values()) {
                Server.#cancelReader(reader);
            }
        }

        await this.#closedPromise;
    }

    [Symbol.asyncDispose]() {
        return this.close();
    }

    upgrade(request, options) {
        const upgradeId = wsUpgrades.get(request);

        // eslint-disable-next-line eqeqeq
        if (upgradeId == null) {
            return false;
        }

        const data = options?.data ?? null;
        const headers = options?.headers;

        let headerNames = null;
        let headerValues = null;

        if (headers) {
            headerNames = [];
            headerValues = [];

            if (headers instanceof Headers) {
                headers.forEach((value, name) => {
                    headerNames.push(name + ':');
                    headerValues.push(value);
                });
            } else if (typeof headers === 'object') {
                for (const [ name, value ] of Object.entries(headers)) {
                    headerNames.push(name + ':');
                    headerValues.push(String(value));
                }
            }
        }

        return this.#handle.acceptUpgrade(upgradeId, data, headerNames, headerValues);
    }

    #handleWsUpgrade(upgradeId, method, url, headersArr, remoteAddr) {
        const headers = Server.#parseHeaders(headersArr);
        const host = headers.get('host') || 'localhost';
        const scheme = this.#isTLS ? 'https' : 'http';
        const fullUrl = `${scheme}://${host}${url}`;
        const request = new Request(fullUrl, { method, headers });

        wsUpgrades.set(request, upgradeId);
        this.#handler(request, { server: this, remoteAddress: remoteAddr });
        // server.upgrade(req) must have been called synchronously
    }

    async #handleRequest(requestId, method, url, headersArr, bodyBuffer, remoteAddr, isStreaming, httpVersion) {
        let headersSent = false;

        try {
            const headers = Server.#parseHeaders(headersArr);

            // Build Request.
            const host = headers.get('host') || 'localhost';
            const scheme = this.#isTLS ? 'https' : 'http';
            const fullUrl = `${scheme}://${host}${url}`;
            const requestInit = { method, headers };

            if (isStreaming && method !== 'GET' && method !== 'HEAD') {
                const stream = new ReadableStream({
                    start: controller => {
                        this.#streamControllers.set(requestId, controller);
                    },
                });

                requestInit.body = stream;
                requestInit.duplex = 'half';
            } else if (bodyBuffer && bodyBuffer.byteLength > 0 && method !== 'GET' && method !== 'HEAD') {
                requestInit.body = bodyBuffer;
            }

            const request = new Request(fullUrl, requestInit);

            // Call user handler.
            let response = this.#handler(request, { server: this, remoteAddress: remoteAddr, httpVersion });

            if (response instanceof Promise) {
                response = await response;
            }

            if (!(response instanceof Response)) {
                response = new Response('Internal Server Error', { status: 500 });
            }

            // Extract response data.
            const status = response.status;
            const responseHeaders = [];

            response.headers.forEach((value, name) => {
                responseHeaders.push([ name, value ]);
            });

            if (response.body && response.bodySize < 0) {
                // Streaming: send headers first, then stream body chunks.
                // Filter hop-by-hop headers that lws manages itself.
                const streamHeaders = responseHeaders.filter(
                    ([ name ]) => !kHopByHopHeaders.has(name),
                );

                // sendHeaders, getReader and the map insert run in one turn, so a
                // close either makes sendHeaders fail or finds the reader in the map.
                if (!this.#handle.sendHeaders(requestId, status, streamHeaders)) {
                    await Server.#cancelReader(response.body.getReader());

                    return;
                }

                headersSent = true;

                const reader = response.body.getReader();

                this.#responseReaders.set(requestId, reader);

                try {
                    while (true) {
                        const { done, value } = await reader.read();

                        // After a cancel (request or server closed) read() resolves
                        // done too; sendBody then returns false and sends nothing.
                        if (done) {
                            this.#handle.sendBody(requestId, null, true);
                            break;
                        }

                        if (!this.#handle.sendBody(requestId, value, false)) {
                            await Server.#cancelReader(reader);
                            break;
                        }
                    }
                } finally {
                    this.#responseReaders.delete(requestId);
                }
            } else {
                // Buffered: read entire body and send at once.
                let body = null;

                if (response.body) {
                    const buf = await response.arrayBuffer();

                    body = new Uint8Array(buf);
                }

                this.#handle.sendResponse(requestId, status, responseHeaders, body);
            }
        } catch (_error) {
            if (headersSent) {
                // Headers already sent, close the stream.
                try {
                    this.#handle.sendBody(requestId, null, true);
                } catch {
                    // Nothing we can do.
                }
            } else {
                try {
                    const errorBody = new TextEncoder().encode('Internal Server Error');

                    this.#handle.sendResponse(
                        requestId, 500, [ [ 'content-type', 'text/plain' ] ], errorBody,
                    );
                } catch {
                    // Nothing we can do.
                }
            }
        }
    }

    static async #cancelReader(reader) {
        try {
            await reader.cancel();
        } catch {
            // The body's cancel() threw; the response is gone either way.
        }
    }

    static #parseHeaders(headersArr) {
        const headers = new Headers();

        for (let i = 0; i < headersArr.length; i += 2) {
            headers.append(headersArr[i], headersArr[i + 1]);
        }

        return headers;
    }
}

export function serve(options) {
    return new Server(options);
}
