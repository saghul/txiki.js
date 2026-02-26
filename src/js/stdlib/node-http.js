// Node.js HTTP compatibility layer
// Provides Node.js-style HTTP API on top of txiki.js's Fetch API

import { serve } from 'tjs:core';

// HTTP status codes mapping
const STATUS_CODES = {
    100: 'Continue',
    101: 'Switching Protocols',
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    203: 'Non-Authoritative Information',
    204: 'No Content',
    205: 'Reset Content',
    206: 'Partial Content',
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    305: 'Use Proxy',
    307: 'Temporary Redirect',
    308: 'Permanent Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Payload Too Large',
    414: 'URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Range Not Satisfiable',
    417: 'Expectation Failed',
    418: 'I\'m a teapot',
    422: 'Unprocessable Entity',
    426: 'Upgrade Required',
    429: 'Too Many Requests',
    431: 'Request Header Fields Too Large',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    505: 'HTTP Version Not Supported',
    506: 'Variant Also Negotiates',
    507: 'Insufficient Storage',
    508: 'Loop Detected',
    510: 'Not Extended',
    511: 'Network Authentication Required'
};

// Node.js IncomingMessage
class IncomingMessage {
    constructor(request) {
        this._req = request;
        this._body = null;
        this._bodyUsed = false;

        const url = new URL(request.url);

        this.url = url.pathname + url.search;
        this.method = request.method;
        this.httpVersion = '1.1';

        // Parse headers
        this.headers = {};
        this.headersRaw = {};
        request.headers.forEach((value, name) => {
            this.headers[name.toLowerCase()] = value;
            this.headersRaw[name] = value;
        });

        this.statusCode = null;
        this.statusMessage = null;
        this.complete = false;

        // Socket info
        this.socket = {
            remoteAddress: request.remoteAddress || '127.0.0.1',
            remotePort: request.remotePort || 0,
            localAddress: '127.0.0.1',
            localPort: request.serverPort || 0
        };
    }

    get body() {
        if (!this._bodyUsed) {
            this._bodyUsed = true;
        }

        return this._req.body;
    }

    set body(value) {
        this._body = value;
    }

    async arrayBuffer() {
        if (this._bodyUsed) {
            throw new Error('Body already used');
        }

        this._bodyUsed = true;

        return this._req.arrayBuffer();
    }

    async text() {
        if (this._bodyUsed) {
            throw new Error('Body already used');
        }

        this._bodyUsed = true;

        return this._req.text();
    }

    async json() {
        if (this._bodyUsed) {
            throw new Error('Body already used');
        }

        this._bodyUsed = true;

        return this._req.json();
    }

    getHeader(name) {
        return this.headers[name.toLowerCase()] || null;
    }

    getHeaders() {
        return { ...this.headers };
    }
}

// Node.js ServerResponse
class ServerResponse {
    constructor() {
        this.statusCode = 200;
        this.statusMessage = STATUS_CODES[200];
        this.headers = {};
        this.headersSent = false;
        this.finished = false;
        this._body = null;
        this._encoder = new TextEncoder();
    }

    setHeader(name, value) {
        if (this.headersSent) {
            throw new Error('Headers already sent');
        }

        this.headers[name] = value;

        return this;
    }

    getHeader(name) {
        return this.headers[name] || null;
    }

    getHeaders() {
        return { ...this.headers };
    }

    removeHeader(name) {
        if (this.headersSent) {
            throw new Error('Headers already sent');
        }

        delete this.headers[name];

        return this;
    }

    hasHeader(name) {
        return name in this.headers;
    }

    writeHead(statusCode, statusMessage, headers) {
        if (this.headersSent) {
            throw new Error('Headers already sent');
        }

        this.statusCode = statusCode;

        if (typeof statusMessage === 'string') {
            this.statusMessage = statusMessage;
        } else {
            this.statusMessage = STATUS_CODES[statusCode] || 'Unknown';
            headers = statusMessage;
        }

        if (headers) {
            Object.assign(this.headers, headers);
        }

        return this;
    }

    write(chunk, encoding, callback) {
        if (this.finished) {
            throw new Error('Response already finished');
        }

        if (typeof chunk === 'string') {
            chunk = this._encoder.encode(chunk);
        }

        if (!this._body) {
            this._body = chunk;
        } else {
            const newBuffer = new Uint8Array(this._body.length + chunk.length);

            newBuffer.set(this._body, 0);
            newBuffer.set(chunk, this._body.length);
            this._body = newBuffer;
        }

        if (typeof encoding === 'function') {
            encoding();
        } else if (callback) {
            callback();
        }

        return true;
    }

    end(chunk, encoding, callback) {
        if (this.finished) {
            throw new Error('Response already finished');
        }

        if (chunk) {
            this.write(chunk, encoding);
        }

        this.finished = true;

        if (typeof encoding === 'function') {
            encoding();
        } else if (callback) {
            callback();
        }

        return this;
    }

    toResponse() {
        const headersArray = [];

        for (const [ name, value ] of Object.entries(this.headers)) {
            headersArray.push([ name, value ]);
        }

        return new Response(this._body, {
            status: this.statusCode,
            headers: headersArray
        });
    }
}

// Node.js Server
class Server {
    constructor(requestListener) {
        this._requestListener = requestListener;
        this._server = null;
        this._listening = false;
    }

    listen(port, hostname, callback) {
        if (typeof hostname === 'function') {
            callback = hostname;
            hostname = undefined;
        }

        const serverOptions = {
            port: port || 0,
            listenIp: hostname || '0.0.0.0',
            fetch: request => new Promise(resolve => {
                const req = new IncomingMessage(request);
                const res = new ServerResponse();

                if (this._requestListener) {
                    const result = this._requestListener(req, res);

                    Promise.resolve(result).then(() => {
                        resolve(res.toResponse());
                    }).catch(err => {
                        console.error('Request handler error:', err);
                        res.writeHead(500);
                        res.end('Internal Server Error');
                        resolve(res.toResponse());
                    });
                } else {
                    resolve(new Response('OK', { status: 200 }));
                }
            })
        };

        this._server = serve(serverOptions);
        this._listening = true;

        if (callback) {
            callback();
        }

        return this;
    }

    close(callback) {
        if (this._server) {
            this._server.close();
            this._listening = false;
            this._server = null;
        }

        if (callback) {
            callback();
        }

        return this;
    }

    get listening() {
        return this._listening;
    }

    address() {
        if (!this._server) {
            return null;
        }

        return {
            address: '0.0.0.0',
            family: 'IPv4',
            port: this._server.port
        };
    }
}

// Factory function
function createServer(requestListener) {
    return new Server(requestListener);
}

// Export
export { Server, createServer, STATUS_CODES, IncomingMessage, ServerResponse };
