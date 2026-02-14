import { Headers, normalizeName, normalizeValue } from './headers.js';
import { Request } from './request.js';
import { Response } from './response.js';

// Access the internal HttpClient implementation directly.
const core = globalThis[Symbol.for('tjs.internal.core')];
const HttpClient = core.HttpClient;

// Keep strong references to active clients to prevent premature GC
const activeClients = new Set();

export function fetch(input, init) {
    return new Promise(function(resolve, reject) {
        const request = new Request(input, init);

        if (request.signal && request.signal.aborted) {
            return reject(new DOMException('Aborted', 'AbortError'));
        }

        const client = new HttpClient();

        activeClients.add(client);

        let responseResolved = false;
        let streamController = null;
        let responseStatus, responseUrl;
        const responseHeaders = new Headers();

        function abortClient() {
            client.abort();
        }

        // Create ReadableStream for response body
        const responseBody = new ReadableStream({
            start(controller) {
                streamController = controller;
            },
            cancel() {
                client.abort();
            }
        });

        client.onstatus = function(status) {
            responseStatus = status;
        };

        client.onurl = function(url) {
            responseUrl = url;
        };

        client.onheader = function(name, value) {
            try {
                responseHeaders.append(name, value);
            } catch (e) { /* ignore invalid headers */ }
        };

        client.onheadersend = function() {
            // Skip informational responses (1xx)
            if (responseStatus >= 100 && responseStatus < 200) {
                return;
            }

            responseResolved = true;

            setTimeout(function() {
                resolve(new Response(responseBody, {
                    status: responseStatus,
                    statusText: '',
                    headers: responseHeaders,
                    url: responseUrl
                }));
            }, 0);
        };

        // Called for each body chunk
        client.ondata = function(chunk) {
            if (chunk && chunk.byteLength > 0 && streamController) {
                streamController.enqueue(new Uint8Array(chunk));
            }
        };

        // Called when request completes (success or error)
        client.oncomplete = function(error, reason) {
            activeClients.delete(client);

            if (request.signal) {
                request.signal.removeEventListener('abort', abortClient);
            }

            if (error) {
                const isAbort = error === 'ABORTED';
                const isTimeout = error === 'TIMED_OUT';

                let msg;

                if (reason) {
                    msg = `Network request failed: ${reason}`;
                } else if (isTimeout) {
                    msg = 'Network request timed out';
                } else {
                    msg = 'Network request failed';
                }

                if (!responseResolved) {
                    if (streamController) {
                        try {
                            streamController.error(isAbort
                                ? new DOMException('Aborted', 'AbortError')
                                : new TypeError(msg));
                        } catch (e) { /* already errored/closed */ }

                        streamController = null;
                    }

                    setTimeout(function() {
                        if (isAbort) {
                            reject(new DOMException('Aborted', 'AbortError'));
                        } else {
                            reject(new TypeError(msg));
                        }
                    }, 0);
                } else if (streamController) {
                    if (isAbort) {
                        streamController.error(new DOMException('Aborted', 'AbortError'));
                    } else {
                        streamController.error(new TypeError(msg));
                    }

                    streamController = null;
                }
            } else {
                if (streamController) {
                    streamController.close();
                    streamController = null;
                }
            }
        };

        // Configure client before opening the connection.
        if (request.credentials === 'include') {
            client.setEnableCookies(true);
        }

        client.redirectMode = request.redirect;

        if (init && typeof init.headers === 'object' && !(init.headers instanceof Headers)) {
            const names = [];

            Object.getOwnPropertyNames(init.headers).forEach(function(name) {
                names.push(normalizeName(name));
                client.setRequestHeader(name, normalizeValue(init.headers[name]));
            });
            request.headers.forEach(function(value, name) {
                if (names.indexOf(name) === -1) {
                    client.setRequestHeader(name, value);
                }
            });
        } else {
            request.headers.forEach(function(value, name) {
                client.setRequestHeader(name, value);
            });
        }

        if (request.signal) {
            request.signal.addEventListener('abort', abortClient);
        }

        // Open the connection. Body handling depends on request type.
        if (request._bodySize === -1) {
            // Streaming body (ReadableStream)
            client.streaming = true;

            const reader = request.body.getReader();

            client.ondrain = function() {
                reader.read().then(function({ value, done }) {
                    if (done) {
                        client.sendData(null);
                    } else {
                        if (!(value instanceof Uint8Array)) {
                            client.abort();
                            reject(new TypeError('ReadableStream body chunks must be Uint8Array'));

                            return;
                        }

                        client.sendData(value);
                    }
                }).catch(function() {
                    client.abort();
                });
            };

            client.open(request.method, request.url);
        } else if (request._bodySize > 0) {
            // Known-size body - read it all and pass to open
            request.arrayBuffer().then(function(buf) {
                client.open(request.method, request.url, new Uint8Array(buf));
            }).catch(function(err) {
                activeClients.delete(client);
                reject(err);
            });
        } else {
            // No body
            client.open(request.method, request.url);
        }
    });
}
