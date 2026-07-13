import { cloneBody, initBody, mixinBody, takeBodyStream } from './body.js';
import { Headers } from './headers.js';


export class Request {
    constructor(input, options = {}) {
        let body = options.body;

        if (input instanceof Request) {
            if (input.bodyUsed) {
                throw new TypeError('Already read');
            }

            this.url = input.url;
            this.credentials = input.credentials;
            this.redirect = input.redirect;

            if (!options.headers) {
                this.headers = new Headers(input.headers);
            }

            this.method = input.method;
            this.mode = input.mode;
            this.signal = input.signal;

            if (!body && input.body !== null) {
                body = takeBodyStream(input);
            }
        } else {
            this.url = String(input);
        }

        this.credentials = options.credentials || this.credentials || 'same-origin';
        this.redirect = options.redirect || this.redirect || 'follow';

        if (options.headers || !this.headers) {
            this.headers = new Headers(options.headers);
        }

        this.method = normalizeMethod(options.method || this.method || 'GET');
        this.mode = options.mode || this.mode || null;
        this.signal = options.signal || this.signal || null;
        this.referrer = null;

        if ((this.method === 'GET' || this.method === 'HEAD') && body) {
            throw new TypeError('Body not allowed for GET or HEAD requests');
        }

        // A user-supplied ReadableStream body requires duplex: 'half' (spec
        // compliant). A stream inherited from another Request — via clone(), or
        // fetch() re-wrapping a Request argument — is an internal body and
        // carries no such requirement.
        if (options.body instanceof ReadableStream && options.duplex !== 'half') {
            throw new TypeError('ReadableStream body requires duplex: "half" option');
        }

        initBody(this, body);

        if (this.method === 'GET' || this.method === 'HEAD') {
            if (options.cache === 'no-store' || options.cache === 'no-cache') {
                // Search for a '_' parameter in the query string
                const reParamSearch = /([?&])_=[^&]*/;

                if (reParamSearch.test(this.url)) {
                    // If it already exists then set the value with the current time
                    this.url = this.url.replace(reParamSearch, '$1_=' + new Date().getTime());
                } else {
                    // Otherwise add a new '_' parameter to the end with the current time
                    const reQueryString = /\?/;

                    this.url += (reQueryString.test(this.url) ? '&' : '?') + '_=' + new Date().getTime();
                }
            }
        }
    }

    clone() {
        const body = cloneBody(this);

        return new Request(this, { body, duplex: body ? 'half' : undefined });
    }
}

mixinBody(Request.prototype);

// HTTP methods whose capitalization should be normalized.
const methods = [ 'CONNECT', 'DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'TRACE' ];

function normalizeMethod(method) {
    const upcased = method.toUpperCase();

    return methods.indexOf(upcased) > -1 ? upcased : method;
}
