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

        xhr.onload = function() {
            const options = {
                statusText: xhr.statusText,
                headers: parseHeaders(xhr.getAllResponseHeaders() || ''),
                status: xhr.status,
                url: xhr.responseURL
            };
            const body = xhr.response;

            setTimeout(function() {
                resolve(new Response(body, options));
            }, 0);
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

        if (request.signal) {
            request.signal.addEventListener('abort', abortXhr);

            xhr.onreadystatechange = function() {
                // DONE (success or failure)
                if (xhr.readyState === xhr.DONE) {
                    request.signal.removeEventListener('abort', abortXhr);
                }
            };
        }

        // TODO: why not use the .body property?
        xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit);
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
