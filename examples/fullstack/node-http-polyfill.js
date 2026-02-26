// Test Node.js HTTP compatibility layer with Express-like API
import { createServer, STATUS_CODES } from 'tjs:express-adapter';

const server = createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);
    console.log('Headers:', req.getHeaders());
    console.log('Path:', req.path);
    console.log('Query:', Object.fromEntries(req.query));

    // Test different response methods
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write('<h1>Hello World!</h1>');
        res.end('<p>Welcome to txiki.js Node.js HTTP compatibility layer</p>');
    } else if (req.url === '/json') {
        res.json({ message: 'Hello from JSON', status: 'success' });
    } else if (req.url === '/status') {
        res.status(201).send('Created');
    } else if (req.url === '/sendstatus') {
        res.sendStatus(200);
    } else if (req.url === '/text') {
        res.send('Plain text response');
    } else {
        res.status(404).send('Not Found');
    }
});

server.listen(8888, () => {
    console.log('Server running on http://localhost:8888');
    console.log('Test endpoints:');
    console.log('  / - HTML response');
    console.log('  /json - JSON response');
    console.log('  /status - Custom status');
    console.log('  /sendstatus - Send status code');
    console.log('  /text - Plain text');
});
