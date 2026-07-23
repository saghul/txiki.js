/* global tjs */

import { HttpClient } from '../http-client.js';

import { dropH3, hasH3, noteAltSvc } from './alt-svc.js';
import { Headers, normalizeName, normalizeValue } from './headers.js';
import { Request } from './request.js';
import { Response } from './response.js';

// Private signal from sendRequest() back to fetch(): an h3 attempt failed
// before producing a response and is eligible for an h1/h2 retry. A Symbol
// keeps it off the error's enumerable surface and out of reach of user code.
const kH3Fallback = Symbol('h3Fallback');

async function fetchFileURI(url) {
    // Strip file:// prefix and decode. Handles both POSIX (file:///tmp/foo)
    // and Windows (file://C:\foo) paths.
    const filePath = decodeURIComponent(url.slice(7));

    let fh;

    try {
        fh = await tjs.open(filePath, 'r');
    } catch {
        throw new TypeError(`File not found: ${filePath}`);
    }

    return new Response(fh.readable, {
        status: 200,
        statusText: 'OK',
        url,
    });
}

function fetchDataURI(url) {
    // Format: data:[<mediatype>][;base64],<data>
    const afterScheme = url.slice(5); // strip "data:"
    const commaIdx = afterScheme.indexOf(',');

    if (commaIdx === -1) {
        return Promise.reject(new TypeError('Invalid data URI'));
    }

    const meta = afterScheme.slice(0, commaIdx);
    const encoded = afterScheme.slice(commaIdx + 1);
    const isBase64 = meta.endsWith(';base64');
    const mimeType = (isBase64 ? meta.slice(0, -7) : meta) || 'text/plain;charset=US-ASCII';

    let bytes;

    if (isBase64) {
        const binary = atob(encoded);

        bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
    } else {
        bytes = new TextEncoder().encode(decodeURIComponent(encoded));
    }

    return Promise.resolve(new Response(bytes, {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': mimeType },
    }));
}

// Keep strong references to active clients to prevent premature GC
const activeClients = new Set();

// Perform a single HTTP request attempt. Resolves with a Response once the
// response headers arrive. `opts.useH3` routes the attempt over HTTP/3; on a
// pre-response connection failure of an h3 attempt the returned promise rejects
// with an error tagged with the kH3Fallback symbol so fetch() can retry over
// h1/h2.
function sendRequest(request, init, opts) {
    const { origin, originHost, originPort, bodyBytes, streaming, useH3 } = opts;

    return new Promise(function(resolve, reject) {
        const client = new HttpClient();

        if (init?.allowInsecure) {
            client.setAllowInsecure(true);
        }

        if (useH3) {
            client.setHttp3(true);
        }

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
            } catch (_e) { /* ignore invalid headers */ }
        };

        client.onheadersend = function() {
            // Skip informational responses (1xx)
            if (responseStatus >= 100 && responseStatus < 200) {
                return;
            }

            // Learn HTTP/3 availability for this origin from Alt-Svc (an h3
            // response never carries it, so this only fires on h1/h2).
            noteAltSvc(origin, responseHeaders.get('alt-svc'), originHost, originPort);

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
                    // An h3 attempt that fails before producing a response can
                    // be retried over h1/h2 (not for user aborts).
                    if (useH3 && !isAbort) {
                        if (streamController) {
                            try {
                                streamController.error(new TypeError(msg));
                            } catch (_e) { /* already errored/closed */ }

                            streamController = null;
                        }

                        const err = new TypeError(msg);

                        err[kH3Fallback] = true;
                        setTimeout(function() {
                            reject(err);
                        }, 0);

                        return;
                    }

                    if (streamController) {
                        try {
                            streamController.error(isAbort
                                ? new DOMException('Aborted', 'AbortError')
                                : new TypeError(msg));
                        } catch (_e) { /* already errored/closed */ }

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
        if (streaming) {
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
        } else if (bodyBytes) {
            client.open(request.method, request.url, bodyBytes);
        } else {
            client.open(request.method, request.url);
        }
    });
}

export function fetch(input, init) {
    const rawUrl = typeof input === 'string' ? input : input?.url;

    if (rawUrl?.startsWith('data:')) {
        return fetchDataURI(rawUrl);
    }

    if (rawUrl?.startsWith('file:')) {
        return fetchFileURI(rawUrl);
    }

    let tmpUrl;

    try {
        tmpUrl = new URL(rawUrl);
    } catch (e) {
        return Promise.reject(e);
    }

    const { protocol } = tmpUrl;

    if (protocol !== 'http:' && protocol !== 'https:') {
        return Promise.reject(new TypeError(`Unsupported protocol: ${protocol}`));
    }

    const origin = `${protocol}//${tmpUrl.host}`;
    const originHost = tmpUrl.hostname;
    const secure = protocol === 'https:';

    let originPort;

    if (tmpUrl.port) {
        originPort = parseInt(tmpUrl.port, 10);
    } else {
        originPort = secure ? 443 : 80;
    }

    return new Promise(function(resolve, reject) {
        let request;

        try {
            request = new Request(input, init);
        } catch (e) {
            return reject(e);
        }

        if (request.signal && request.signal.aborted) {
            return reject(new DOMException('Aborted', 'AbortError'));
        }

        const streaming = request.bodySize === -1;

        // HTTP/3 auto-upgrade is limited to bodyless requests (GET/HEAD and the
        // like) for now: lws's QUIC client does not yet flush a request body
        // DATA frame after the HEADERS, so a body-bearing request would arrive
        // empty. Requests with a body stay on h1/h2 (which handle bodies
        // correctly). This is where h3 helps most anyway.
        const wantH3 = secure && request.bodySize === 0 && hasH3(origin);

        const bodyReady = request.bodySize > 0
            ? request.arrayBuffer().then(buf => new Uint8Array(buf))
            : Promise.resolve(null);

        bodyReady.then(function(bodyBytes) {
            const opts = { origin, originHost, originPort, bodyBytes, streaming };

            function attempt(useH3) {
                sendRequest(request, init, { ...opts, useH3 }).then(resolve, function(err) {
                    if (useH3 && err && err[kH3Fallback]) {
                        dropH3(origin);
                        attempt(false);
                    } else {
                        reject(err);
                    }
                });
            }

            attempt(wantH3);
        }).catch(reject);
    });
}
