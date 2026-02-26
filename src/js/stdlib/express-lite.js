// Express-lite for txiki.js
// A lightweight Express-compatible framework with integrated HTTP server

// Use the global tjs object
const serve = globalThis.tjs?.serve;

// HTTP status codes
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
    418: "I'm a teapot",
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

// EventEmitter polyfill
class EventEmitter {
    constructor() {
        this._events = {};
    }
    
    on(event, listener) {
        if (!this._events[event]) this._events[event] = [];
        this._events[event].push(listener);
        return this;
    }
    
    emit(event, ...args) {
        if (this._events[event]) {
            this._events[event].forEach(fn => fn(...args));
        }
        return this;
    }
    
    once(event, listener) {
        const wrapper = (...args) => {
            listener(...args);
            this.off(event, wrapper);
        };
        return this.on(event, wrapper);
    }
    
    off(event, listener) {
        if (this._events[event]) {
            this._events[event] = this._events[event].filter(fn => fn !== listener);
        }
        return this;
    }
}

// Convert Express path pattern to regex
function pathToRegex(path) {
    let regex = path;
    const paramNames = [];
    
    // Convert :param to named groups
    regex = regex.replace(/:([a-zA-Z_]\w*)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
    });
    
    // Convert * to wildcard
    regex = regex.replace(/\*/g, '.*');
    
    // Ensure exact match
    regex = `^${regex}$`;
    
    return { regex: new RegExp(regex), paramNames };
}

// Express-compatible IncomingMessage
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

        // Express properties
        this.originalUrl = this.url;
        this.path = url.pathname;
        this.query = url.searchParams;
        this.params = {};
        this.route = null;
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

    getHeader(name) {
        return this.headers[name.toLowerCase()] || null;
    }

    getHeaders() {
        return { ...this.headers };
    }

    async json() {
        if (this._bodyUsed) {
            throw new Error('Body already used');
        }
        this._bodyUsed = true;
        const text = await this._req.text();
        return JSON.parse(text);
    }
}

// Express-compatible ServerResponse
class ServerResponse {
    constructor() {
        this.statusCode = 200;
        this.statusMessage = STATUS_CODES[200];
        this.headers = {};
        this.headersSent = false;
        this.finished = false;
        this._body = null;
        this._encoder = new TextEncoder();
        this._chunkedEncoding = false;
    }

    status(code) {
        this.statusCode = code;
        return this;
    }

    sendStatus(code) {
        this.statusCode = code;
        this.end(STATUS_CODES[code] || '');
        return this;
    }

    setHeader(name, value) {
        if (this.headersSent) {
            return this;
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
            return this;
        }
        delete this.headers[name];
        return this;
    }

    hasHeader(name) {
        return name in this.headers;
    }

    writeHead(statusCode, statusMessage, headers) {
        if (this.headersSent) {
            return this;
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
            return false;
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
            return this;
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

    json(obj) {
        this.setHeader('Content-Type', 'application/json');
        return this.send(JSON.stringify(obj));
    }

    send(body) {
        if (typeof body === 'object') {
            return this.json(body);
        } else if (typeof body === 'number') {
            return this.end(String(body));
        } else if (typeof body === 'boolean') {
            return this.end(body ? 'true' : 'false');
        } else if (body === null || body === undefined) {
            return this.end();
        } else {
            return this.end(String(body));
        }
    }

    toResponse() {
        const headersArray = [];
        for (const [name, value] of Object.entries(this.headers)) {
            headersArray.push([name, value]);
        }

        return new Response(this._body, {
            status: this.statusCode,
            headers: headersArray
        });
    }
}

// Express-compatible HTTP server
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

        if (!serve) {
            throw new Error('serve function is not available in txiki.js');
        }

        const serverOptions = {
            port: port || 0,
            listenIp: hostname || '0.0.0.0',
            fetch: (request, context) => {
                return new Promise((resolve) => {
                    const req = new IncomingMessage(request);
                    const res = new ServerResponse();

                    if (this._requestListener) {
                        try {
                            const result = this._requestListener(req, res);
                            if (result && typeof result.then === 'function') {
                                result.then(() => {
                                    resolve(res.toResponse());
                                }).catch((err) => {
                                    console.error('Request handler error:', err);
                                    res.writeHead(500);
                                    res.end('Internal Server Error');
                                    resolve(res.toResponse());
                                });
                            } else {
                                resolve(res.toResponse());
                            }
                        } catch (err) {
                            console.error('Request handler error:', err);
                            res.writeHead(500);
                            res.end('Internal Server Error');
                            resolve(res.toResponse());
                        }
                    } else {
                        resolve(new Response('OK', { status: 200 }));
                    }
                });
            }
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

// Express Application
class ExpressLite extends EventEmitter {
    constructor() {
        super();
        this.routes = {
            GET: [],
            POST: [],
            PUT: [],
            DELETE: [],
            PATCH: [],
            ALL: []
        };
        this.middleware = [];
        this.settings = {
            'x-powered-by': true,
            'etag': 'weak',
            'env': 'development'
        };
    }

    use(middleware) {
        this.middleware.push(middleware);
        return this;
    }

    enable(setting) {
        this.settings[setting] = true;
        return this;
    }

    disable(setting) {
        this.settings[setting] = false;
        return this;
    }

    enabled(setting) {
        return this.settings[setting] === true;
    }

    disabled(setting) {
        return this.settings[setting] !== true;
    }

    set(setting, value) {
        if (arguments.length === 1) {
            return this.settings[setting];
        }
        this.settings[setting] = value;
        return this;
    }

    get(path, ...handlers) {
        this._addRoute('GET', path, handlers);
        return this;
    }

    post(path, ...handlers) {
        this._addRoute('POST', path, handlers);
        return this;
    }

    put(path, ...handlers) {
        this._addRoute('PUT', path, handlers);
        return this;
    }

    delete(path, ...handlers) {
        this._addRoute('DELETE', path, handlers);
        return this;
    }

    patch(path, ...handlers) {
        this._addRoute('PATCH', path, handlers);
        return this;
    }

    all(path, ...handlers) {
        this._addRoute('ALL', path, handlers);
        return this;
    }

    _addRoute(method, path, handlers) {
        // Convert path pattern to regex
        const { regex, paramNames } = pathToRegex(path);
        this.routes[method].push({ regex, paramNames, handlers });
    }

    listen(port, hostname, callback) {
        if (typeof hostname === 'function') {
            callback = hostname;
            hostname = undefined;
        }

        const server = createServer((req, res) => {
            this._handleRequest(req, res);
        });

        server.listen(port, hostname, callback);
        return server;
    }

    _handleRequest(req, res) {
        try {
            // Run middleware
            for (const middleware of this.middleware) {
                if (res.finished) return;
                this._runHandler(middleware, req, res);
            }

            // Find matching route
            const method = req.method.toUpperCase();
            const routes = [...this.routes[method], ...this.routes.ALL];
            const url = req.path;

            for (const route of routes) {
                const match = url.match(route.regex);
                if (match) {
                    // Extract path parameters
                    req.params = this._extractParams(route, url);
                    
                    // Run handlers sequentially
                    for (const handler of route.handlers) {
                        if (res.finished) break;
                        this._runHandler(handler, req, res);
                    }
                    return;
                }
            }

            // 404 Not Found
            if (!res.finished) {
                res.status(404).send('Not Found');
            }
        } catch (err) {
            console.error('Express error:', err);
            if (!res.finished) {
                res.status(500).send('Internal Server Error');
            }
        }
    }

    _runHandler(handler, req, res) {
        if (res.finished) return;
        
        const nextHandler = (err) => {
            if (err) {
                console.error('Handler error:', err);
            }
        };

        const result = handler(req, res, nextHandler);
        
        if (result && typeof result.then === 'function') {
            result.catch((err) => console.error('Async handler error:', err));
        }
    }

    _extractParams(route, url) {
        const params = {};
        const match = url.match(route.regex);
        
        if (match && route.paramNames) {
            // Match values (skip the full match at index 0)
            route.paramNames.forEach((name, index) => {
                if (match[index + 1]) {
                    params[name] = match[index + 1];
                }
            });
        }
        
        return params;
    }

    // Express static method
    static static(root) {
        return (req, res, next) => {
            res.send(`Static files from: ${root}`);
        };
    }

    // Router method
    static Router() {
        const router = new ExpressLite();
        router._isRouter = true;
        return router;
    }
}

// Default export
export default function express() {
    return new ExpressLite();
}

// Export classes and utilities
export { 
    ExpressLite as Router, 
    createServer, 
    Server, 
    IncomingMessage, 
    ServerResponse, 
    STATUS_CODES,
    EventEmitter
};