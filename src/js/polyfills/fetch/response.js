import { BodyMixin } from './body.js';
import { Headers } from './headers.js';


const redirectStatuses = [ 301, 302, 303, 307, 308 ];

export class Response {
    constructor(bodyInit, options = {}) {
        Object.assign(this, BodyMixin);

        this.type = 'default';
        this.status = options.status === undefined ? 200 : options.status;

        if (this.status < 200 || this.status > 599) {
            throw new RangeError(`The status provided (${this.status}) is outside the range [200, 599].`);
        }

        this.ok = this.status >= 200 && this.status < 300;
        this.statusText = options.statusText === undefined ? '' : '' + options.statusText;
        this.headers = new Headers(options.headers);
        this.url = options.url || '';

        this._initBody(bodyInit);
    }

    static error() {
        const response = new Response(null, { status: 200, statusText: '' });

        response.ok = false;
        response.status = 0;
        response.type = 'error';

        return response;
    }

    static json(data, init = {}) {
        const body = JSON.stringify(data);
        const headers = new Headers(init.headers);

        if (!headers.has('content-type')) {
            headers.set('content-type', 'application/json');
        }

        return new Response(body, {
            ...init,
            headers,
        });
    }

    static redirect(url, status) {
        if (redirectStatuses.indexOf(status) === -1) {
            throw new RangeError('Invalid status code');
        }

        return new Response(null, { status: status, headers: { location: url } });
    }

    clone() {
        return new Response(this.body, {
            status: this.status,
            statusText: this.statusText,
            headers: new Headers(this.headers),
            url: this.url
        });
    }
}
