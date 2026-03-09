const core = globalThis[Symbol.for('tjs.internal.core')];
const HttpServer = core.HttpServer;

// Hop-by-hop headers managed by lws; must not be passed through for streaming responses.
const kHopByHopHeaders = new Set([ 'transfer-encoding', 'connection', 'content-length', 'keep-alive' ]);

const kWsUpgrade = Symbol('kWsUpgrade');

class Server {
    #handle;
    #handler;
    #isTLS;

    constructor(options) {
        if (typeof options === 'function') {
            options = { fetch: options };
        }

        const { fetch: handler, port = 0, listenIp = '0.0.0.0', websocket, tls } = options;

        if (typeof handler !== 'function') {
            throw new TypeError('fetch handler must be a function');
        }

        this.#handler = handler;

        let certPem = null;
        let keyPem = null;
        let caPem = null;
        let passphrase = null;
        let requestCert = false;

        if (tls) {
            if (typeof tls.cert !== 'string' || typeof tls.key !== 'string') {
                throw new TypeError('tls.cert and tls.key must be strings containing PEM data');
            }

            certPem = tls.cert;
            keyPem = tls.key;
            caPem = tls.ca ?? null;
            passphrase = tls.passphrase ?? null;
            requestCert = !!tls.requestCert;
        }

        this.#isTLS = !!tls;

        const onRequest = (requestId, method, url, headersArr, bodyBuffer, remoteAddr, isWsUpgrade) => {
            if (isWsUpgrade) {
                this.#handleWsUpgrade(requestId, method, url, headersArr, remoteAddr);
            } else {
                this.#handleRequest(requestId, method, url, headersArr, bodyBuffer, remoteAddr);
            }
        };

        this.#handle = new HttpServer({
            port,
            listenIp,
            onRequest,
            wsOpen: websocket?.open ?? null,
            wsMessage: websocket?.message ?? null,
            wsClose: websocket?.close ?? null,
            wsError: websocket?.error ?? null,
            certPem,
            keyPem,
            caPem,
            passphrase,
            requestCert,
        });
    }

    get port() {
        return this.#handle.port;
    }

    close() {
        this.#handle.close();
    }

    upgrade(request, options) {
        const upgradeId = request[kWsUpgrade];

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

        request[kWsUpgrade] = upgradeId;
        this.#handler(request, { server: this, remoteAddress: remoteAddr });
        // server.upgrade(req) must have been called synchronously
    }

    async #handleRequest(requestId, method, url, headersArr, bodyBuffer, remoteAddr) {
        let headersSent = false;

        try {
            const headers = Server.#parseHeaders(headersArr);

            // Build Request.
            const host = headers.get('host') || 'localhost';
            const scheme = this.#isTLS ? 'https' : 'http';
            const fullUrl = `${scheme}://${host}${url}`;
            const requestInit = { method, headers };

            if (bodyBuffer && bodyBuffer.byteLength > 0 && method !== 'GET' && method !== 'HEAD') {
                requestInit.body = bodyBuffer;
            }

            const request = new Request(fullUrl, requestInit);

            // Call user handler.
            let response = this.#handler(request, { server: this, remoteAddress: remoteAddr });

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

            if (response.body && response._bodySize < 0) {
                // Streaming: send headers first, then stream body chunks.
                // Filter hop-by-hop headers that lws manages itself.
                const streamHeaders = responseHeaders.filter(
                    ([ name ]) => !kHopByHopHeaders.has(name),
                );

                this.#handle.sendHeaders(requestId, status, streamHeaders);
                headersSent = true;

                const reader = response.body.getReader();


                while (true) {
                    const { done, value } = await reader.read();

                    if (done) {
                        this.#handle.sendBody(requestId, null, true);
                        break;
                    }

                    this.#handle.sendBody(requestId, value, false);
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
