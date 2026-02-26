import { createServer } from 'tjs:express-adapter';

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

function pathToRegex(path) {
    let regex = path;
    const paramNames = [];
    
    regex = regex.replace(/:([a-zA-Z_]\w*)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
    });
    
    regex = regex.replace(/\*/g, '.*');
    regex = `^${regex}$`;
    
    return { regex: new RegExp(regex), paramNames };
}

export class ExpressLite extends EventEmitter {
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
            for (const middleware of this.middleware) {
                if (res.finished) return;
                this._runHandler(middleware, req, res);
            }

            const method = req.method.toUpperCase();
            const routes = [...this.routes[method], ...this.routes.ALL];
            const url = req.path;

            for (const route of routes) {
                const match = url.match(route.regex);
                if (match) {
                    req.params = this._extractParams(route, url);
                    
                    for (const handler of route.handlers) {
                        if (res.finished) break;
                        this._runHandler(handler, req, res);
                    }
                    return;
                }
            }

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
            route.paramNames.forEach((name, index) => {
                if (match[index + 1]) {
                    params[name] = match[index + 1];
                }
            });
        }
        
        return params;
    }

    static static(root) {
        return (req, res, next) => {
            res.send(`Static files from: ${root}`);
        };
    }

    static Router() {
        const router = new ExpressLite();
        router._isRouter = true;
        return router;
    }
}

export default function express() {
    return new ExpressLite();
}