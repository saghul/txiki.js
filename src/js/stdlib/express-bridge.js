// Express bridge for txiki.js
// Bridges txiki.js HTTP server with Express.js application

import { createServer } from 'tjs:express-adapter';

/**
 * Creates an Express-compatible server on txiki.js
 * @param {Function} expressApp - Express application instance
 * @returns {Object} Server instance
 */
export function createExpressServer(expressApp) {
    const server = createServer((req, res) => {
        // Create Express-compatible request
        const expressReq = {
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: req.body,
            
            // Header methods
            get: req.getHeader.bind(req),
            getHeader: req.getHeader.bind(req),
            
            // Express-specific properties
            originalUrl: req.url,
            path: req.path,
            query: Object.fromEntries(req.query),
            params: {},
            route: null,
            
            // Socket info
            socket: req.socket,
            
            // HTTP version
            httpVersion: req.httpVersion,
            
            // Read body
            async json() {
                return req.json();
            }
        };
        
        // Create Express-compatible response
        const expressRes = {
            statusCode: 200,
            headersSent: false,
            finished: false,
            
            // Status methods
            status(code) {
                this.statusCode = code;
                return this;
            },
            
            sendStatus(code) {
                this.statusCode = code;
                this.end(getStatusText(code) || '');
                return this;
            },
            
            // Header methods
            set: res.setHeader.bind(res),
            setHeader: res.setHeader.bind(res),
            get: res.getHeader.bind(res),
            getHeader: res.getHeader.bind(res),
            getHeaders: res.getHeaders.bind(res),
            remove: res.removeHeader.bind(res),
            removeHeader: res.removeHeader.bind(res),
            has: res.hasHeader.bind(res),
            hasHeader: res.hasHeader.bind(res),
            
            // Write methods
            writeHead(statusCode, statusMessage, headers) {
                res.writeHead(statusCode, statusMessage, headers);
                return this;
            },
            
            write(chunk, encoding, callback) {
                const result = res.write(chunk, encoding, callback);
                if (result) this.headersSent = res.headersSent;
                return result;
            },
            
            end(chunk, encoding, callback) {
                const result = res.end(chunk, encoding, callback);
                this.finished = res.finished;
                this.headersSent = res.headersSent;
                return result;
            },
            
            // Send methods
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
            },
            
            json(obj) {
                this.setHeader('Content-Type', 'application/json');
                return this.send(JSON.stringify(obj));
            },
            
            // Express-style methods
            sendFile(filename, options, callback) {
                this.send(`sendFile not implemented: ${filename}`);
                if (typeof options === 'function') callback = options;
                if (callback) callback(null);
                return this;
            },
            
            redirect(url, status) {
                this.statusCode = status || 302;
                this.setHeader('Location', url);
                this.end();
                return this;
            },
            
            render(view, options, callback) {
                this.send(`render not implemented: ${view}`);
                if (typeof options === 'function') callback = options;
                if (callback) callback(null, '');
                return this;
            }
        };
        
        // Call Express app
        try {
            expressApp(expressReq, expressRes);
        } catch (err) {
            console.error('Express error:', err);
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    });
    
    return server;
}

// Helper function to get status text
function getStatusText(code) {
    const statusCodes = {
        200: 'OK',
        201: 'Created',
        204: 'No Content',
        301: 'Moved Permanently',
        302: 'Found',
        304: 'Not Modified',
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        500: 'Internal Server Error',
        502: 'Bad Gateway',
        503: 'Service Unavailable'
    };
    return statusCodes[code];
}

export { createServer };
