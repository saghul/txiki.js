import { Headers, normalizeName, normalizeValue } from './headers.js';
import { Request } from './request.js';
import { Response } from './response.js';

// Access the internal XHR implementation directly, bypassing the public wrapper.
// This allows us to use internal-only features.
const core = globalThis[Symbol.for('tjs.internal.core')];
const InternalXHR = core.XMLHttpRequest;

// Keep strong references to active XHR objects to prevent premature GC
const activeXHRs = new Set();

export function fetch(input, init) {
    return new Promise(function(resolve, reject) {
        const request = new Request(input, init);

        if (request.signal && request.signal.aborted) {
            return reject(new DOMException('Aborted', 'AbortError'));
        }

        const xhr = new InternalXHR();

        activeXHRs.add(xhr);

        let responseResolved = false;
        let streamController = null;

        function abortXhr() {
            xhr.abort();
        }

        function createAbortError() {
            return new DOMException('Aborted', 'AbortError');
        }

        function createNetworkError(message) {
            return new TypeError(message || 'Network request failed');
        }

        // Create ReadableStream for response body
        const responseBody = new ReadableStream({
            start(controller) {
                streamController = controller;
            },
            cancel() {
                xhr.abort();
            }
        });

        // Enqueue chunks on progress
        xhr.onprogress = function() {
            const chunk = xhr.getAndClearResponseBuffer();

            if (chunk && chunk.byteLength > 0 && streamController) {
                streamController.enqueue(new Uint8Array(chunk));
            }
        };

        // Final chunk + close on load
        xhr.onload = function() {
            const chunk = xhr.getAndClearResponseBuffer();

            if (chunk && chunk.byteLength > 0 && streamController) {
                streamController.enqueue(new Uint8Array(chunk));
            }

            if (streamController) {
                streamController.close();
                streamController = null;
            }

            activeXHRs.delete(xhr);
        };

        xhr.onerror = function() {
            activeXHRs.delete(xhr);

            if (!responseResolved) {
                setTimeout(function() {
                    reject(createNetworkError());
                }, 0);
            } else if (streamController) {
                streamController.error(createNetworkError());
                streamController = null;
            }
        };

        xhr.ontimeout = function() {
            activeXHRs.delete(xhr);

            if (!responseResolved) {
                setTimeout(function() {
                    reject(createNetworkError('Network request timed out'));
                }, 0);
            } else if (streamController) {
                streamController.error(createNetworkError('Network request timed out'));
                streamController = null;
            }
        };

        xhr.onabort = function() {
            activeXHRs.delete(xhr);

            if (!responseResolved) {
                setTimeout(function() {
                    reject(createAbortError());
                }, 0);
            } else if (streamController) {
                streamController.error(createAbortError());
                streamController = null;
            }
        };

        xhr.onreadystatechange = function() {
            if (xhr.readyState === InternalXHR.HEADERS_RECEIVED && !responseResolved) {
                // Skip informational responses (1xx status codes like 100 Continue)
                // These can occur on Windows before the actual response
                if (xhr.status >= 100 && xhr.status < 200) {
                    return;
                }

                responseResolved = true;

                const options = {
                    statusText: xhr.statusText,
                    headers: parseHeaders(xhr.getAllResponseHeaders() || ''),
                    status: xhr.status,
                    url: xhr.responseURL
                };

                // Defer resolve to avoid potential issues
                setTimeout(function() {
                    resolve(new Response(responseBody, options));
                }, 0);
            }

            // DONE (success or failure)
            if (xhr.readyState === InternalXHR.DONE) {
                if (request.signal) {
                    request.signal.removeEventListener('abort', abortXhr);
                }
            }
        };

        xhr.open(request.method, request.url, true);

        if (request.credentials === 'include') {
            xhr.withCredentials = true;
        } else if (request.credentials === 'omit') {
            xhr.withCredentials = false;
        }

        xhr.redirectMode = request.redirect;

        if (init && typeof init.headers === 'object' && !(init.headers instanceof Headers)) {
            const names = [];

            Object.getOwnPropertyNames(init.headers).forEach(function(name) {
                names.push(normalizeName(name));
                xhr.setRequestHeader(name, normalizeValue(init.headers[name]));
            });
            request.headers.forEach(function(value, name) {
                if (names.indexOf(name) === -1) {
                    xhr.setRequestHeader(name, value);
                }
            });
        } else {
            request.headers.forEach(function(value, name) {
                xhr.setRequestHeader(name, value);
            });
        }

        if (request.signal) {
            request.signal.addEventListener('abort', abortXhr);
        }

        // Handle request body based on size
        if (request._bodySize === -1) {
            // Streaming body (ReadableStream)
            const reader = request.body.getReader();

            xhr.onsendstreamdata = function() {
                reader.read().then(function({ value, done }) {
                    if (done) {
                        xhr.sendStream(null);
                    } else {
                        // Ensure we have a Uint8Array
                        const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);

                        xhr.sendStream(chunk);
                    }
                }).catch(function() {
                    xhr.abort();
                });
            };

            xhr.sendStream();  // Start streaming (triggers first onsendstreamdata)
        } else if (request._bodySize > 0) {
            // Known-size body - read it all and send
            request.arrayBuffer().then(function(buf) {
                xhr.send(new Uint8Array(buf));
            }).catch(function(err) {
                activeXHRs.delete(xhr);
                reject(err);
            });
        } else {
            // No body
            xhr.send(null);
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
