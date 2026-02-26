// Test Express.js compatibility on txiki.js
// Note: This demonstrates how to use the Node.js HTTP compatibility layer
// For full Express support, you would need to install express and its dependencies

import { createServer } from 'tjs:express-adapter';

// Simple Express-like router
class ExpressApp {
    constructor() {
        this.routes = {};
        this.middleware = [];
    }

    use(fn) {
        this.middleware.push(fn);
        return this;
    }

    get(path, handler) {
        this.routes[`GET:${path}`] = handler;
        return this;
    }

    post(path, handler) {
        this.routes[`POST:${path}`] = handler;
        return this;
    }

    listen(port, callback) {
        const server = createServer((req, res) => {
            const routeKey = `${req.method}:${req.url}`;
            const handler = this.routes[routeKey];

            if (handler) {
                try {
                    handler(req, res);
                } catch (err) {
                    console.error('Route error:', err);
                    res.status(500).send('Internal Server Error');
                }
            } else {
                res.status(404).send('Not Found');
            }
        });

        server.listen(port, callback);
        return server;
    }
}

// Create Express-like app
const app = new ExpressApp();

// Middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Routes
app.get('/', (req, res) => {
    res.send('Hello from Express-like app on txiki.js!');
});

app.get('/api/users', (req, res) => {
    res.json({
        users: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' }
        ]
    });
});

app.get('/api/hello/:name', (req, res) => {
    const name = req.url.split('/').pop();
    res.json({ message: `Hello, ${name}!` });
});

app.post('/api/data', (req, res) => {
    res.status(201).json({ success: true, message: 'Data created' });
});

// Start server
const PORT = 9999;
app.listen(PORT, () => {
    console.log(`Express-like app running on http://localhost:${PORT}`);
    console.log('Try:');
    console.log(`  curl http://localhost:${PORT}/`);
    console.log(`  curl http://localhost:${PORT}/api/users`);
    console.log(`  curl http://localhost:${PORT}/api/hello/World`);
});
