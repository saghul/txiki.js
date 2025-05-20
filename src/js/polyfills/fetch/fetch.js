import { kXhrGetAndClearResponseBuffer,kXhrOnTjsStreamSendData, kXhrStreamSend } from '../xhr.js';

import { Headers, normalizeName, normalizeValue } from './headers.js';
import { Request } from './request.js';


export function fetch(input, init) {
    return new Promise(function(resolve, reject) {
        const request = new Request(input, init);

        if (request.signal && request.signal.aborted) {
            return reject(new DOMException('Aborted', 'AbortError'));
        }

        const xhr = new XMLHttpRequest();

        function abortXhr() {
            xhr.abort();
        }

        // tjs only
        let controller=null;
        const responseReader=new ReadableStream({
            start(controller_) {
                controller=controller_;
            }
        });

        xhr.onprogress=function() {
            if (controller!==null) {
                controller.enqueue(new Uint8Array(xhr[kXhrGetAndClearResponseBuffer]()));
            }
        };

        xhr.onload=function() {
            if (controller!==null) {
                controller.enqueue(new Uint8Array(xhr[kXhrGetAndClearResponseBuffer]()));
                controller.close();
            }
        };

        xhr.onerror = function() {
            setTimeout(function() {
                reject(new TypeError('Network request failed'));
            }, 0);
        };

        xhr.ontimeout = function() {
            setTimeout(function() {
                reject(new TypeError('Network request timed out'));
            }, 0);
        };

        xhr.onabort = function() {
            setTimeout(function() {
                reject(new DOMException('Aborted', 'AbortError'));
            }, 0);
        };

        xhr.open(request.method, request.url, true);

        if (request.credentials === 'include') {
            xhr.withCredentials = true;
        } else if (request.credentials === 'omit') {
            xhr.withCredentials = false;
        }

        // TODO: better use Blob, if / when we support that.
        xhr.responseType = 'arraybuffer';

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

        xhr.onreadystatechange = function() {
            // DONE (success or failure)
            if (request.signal && xhr.readyState === xhr.DONE) {
                request.signal.removeEventListener('abort', abortXhr);
            }

            if (xhr.readyState === xhr.HEADERS_RECEIVED) {
                const options = {
                    statusText: xhr.statusText,
                    headers: parseHeaders(xhr.getAllResponseHeaders() || ''),
                    status: xhr.status,
                    url: xhr.responseURL
                };

                setTimeout(function() {
                    resolve(new Response(responseReader, options));
                }, 0);
            }
        };

        if (request._bodySize>0) {
            request.arrayBuffer().then(body=>{
                xhr.send(new Uint8Array(body));
            });
        } else if (request._bodySize===-1) {
            const reader=request.body.getReader();

            xhr[kXhrOnTjsStreamSendData]=function() {
                reader.read().then(next=>{
                    if (next.done) {
                        xhr[kXhrStreamSend](null);
                    } else {
                        xhr[kXhrStreamSend](next.value);
                    }
                });
            };

            xhr[kXhrStreamSend]();
        } else {
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
