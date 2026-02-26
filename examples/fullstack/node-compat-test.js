// Test Node.js HTTP compatibility layer functionality
import { createServer, STATUS_CODES } from 'tjs:polyfills/node-http';

const server = createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    console.log(`Headers: ${JSON.stringify(req.headers)}`);

    // Test writeHead
    res.writeHead(200, {
        'Content-Type': 'text/plain',
        'X-Powered-By': 'txiki.js Node.js Compat'
    });

    // Test write
    res.write('Hello ');
    res.write('from ');

    // Test end
    res.end('Node.js API!\n');
});

server.listen(3002, () => {
    console.log('Node.js compatibility server running on http://127.0.0.1:3002');
});
