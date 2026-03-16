import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, baseUrl } = createEchoServer();

// Test that fetch automatically handles compressed responses.

async function testFetchGzip() {
    const response = await fetch(`${baseUrl}/gzip`);

    assert.eq(response.status, 200, 'status should be 200');

    const data = await response.json();

    assert.ok(data.gzipped === true, 'response should indicate gzip was used');
}

// Test that fetch handles deflate compressed responses.
async function testFetchDeflate() {
    const response = await fetch(`${baseUrl}/deflate`);

    assert.eq(response.status, 200, 'status should be 200');

    const data = await response.json();

    assert.ok(data.deflated === true, 'response should indicate deflate was used');
}

await testFetchGzip();
await testFetchDeflate();

server.close();
