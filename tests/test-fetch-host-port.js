// tests/test-fetch-host-port.js
// The client must include a non-default port in the Host header (RFC 7230
// §5.4), so the server reconstructs the correct request URL.
import assert from 'tjs:assert';

const server = tjs.serve({
    port: 0,
    fetch: req => Response.json({
        host: req.headers.get('host'),
        url: req.url,
    }),
});

const expectedHost = `127.0.0.1:${server.port}`;
const url = `http://${expectedHost}/path`;

const res = await fetch(url);
const body = await res.json();

assert.eq(body.host, expectedHost, 'Host header includes the non-default port');
assert.eq(body.url, url, 'reconstructed request URL includes the port');

await server.close();
