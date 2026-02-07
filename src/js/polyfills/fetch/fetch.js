/* global tjs */
import { mkdirSync } from '../utils/mkdirSync';

import { Headers, normalizeName, normalizeValue } from './headers.js';
import { Request } from './request.js';
import { Response } from './response.js';

// Access the internal HttpClient implementation directly.
const core = globalThis[Symbol.for('tjs.internal.core')];
const HttpClient = core.HttpClient;
let hasHomeDirCreated = false;

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

        // Called once when response headers arrive
        client.onresponse = function(status, statusText, url, rawHeaders) {
            // Skip informational responses (1xx status codes like 100 Continue)
            if (status >= 100 && status < 200) {
                return;
            }

            responseResolved = true;

            const options = {
                status: status,
                statusText: statusText,
                headers: parseHeaders(rawHeaders || ''),
                url: url
            };

            // Defer resolve to avoid potential issues
            setTimeout(function() {
                resolve(new Response(responseBody, options));
            }, 0);
        };

        // Called for each body chunk
        client.ondata = function(chunk) {
            if (chunk && chunk.byteLength > 0 && streamController) {
                streamController.enqueue(new Uint8Array(chunk));
            }
        };

        // Called when request completes (success or error)
        client.oncomplete = function(error) {
            activeClients.delete(client);

            if (request.signal) {
                request.signal.removeEventListener('abort', abortClient);
            }

            if (error) {
                const isAbort = error === 'Request aborted';
                const isTimeout = error === 'Request timed out';

                if (!responseResolved) {
                    setTimeout(function() {
                        if (isAbort) {
                            reject(new DOMException('Aborted', 'AbortError'));
                        } else {
                            reject(new TypeError(isTimeout ? 'Network request timed out' : 'Network request failed'));
                        }
                    }, 0);
                } else if (streamController) {
                    if (isAbort) {
                        streamController.error(new DOMException('Aborted', 'AbortError'));
                    } else {
                        streamController.error(
                            new TypeError(isTimeout ? 'Network request timed out' : 'Network request failed'));
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

        client.open(request.method, request.url, true);

        if (request.credentials === 'include') {
            const path = globalThis[Symbol.for('tjs.internal.modules.path')];
            const TJS_HOME = tjs.env.TJS_HOME ?? path.join(tjs.homeDir, '.tjs');

            if (!hasHomeDirCreated) {
                mkdirSync(TJS_HOME, { recursive: true });
                hasHomeDirCreated = true;
            }

            client.setCookieJar(path.join(TJS_HOME, 'cookies'));
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

        // Handle request body based on size
        if (request._bodySize === -1) {
            // Streaming body (ReadableStream)
            client.streaming = true;

            const reader = request.body.getReader();

            const readChunk = () => {
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

            client.ondrain = readChunk;
            readChunk();
        } else if (request._bodySize > 0) {
            // Known-size body - read it all and send
            request.arrayBuffer().then(function(buf) {
                client.sendData(new Uint8Array(buf));
                client.sendData(null);
            }).catch(function(err) {
                activeClients.delete(client);
                reject(err);
            });
        } else {
            // No body
            client.sendData(null);
        }
    });
}


function parseHeaders(rawHeaders) {
    const headers = new Headers();

    // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
    // https://tools.ietf.org/html/rfc7230#section-3.2
    const preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ');

    preProcessedHeaders.split(/\r?\n/).forEach(line => {
        const parts = line.split(':');
        const key = parts.shift().trim();

        if (key) {
            const value = parts.join(':').trim();

            try {
                headers.append(key, value);
            } catch (error) {
                console.warn('Response ' + error.message);
            }
        }
    });

    return headers;
}
