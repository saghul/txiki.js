import assert from 'tjs:assert';

// Test that fetch automatically handles compressed responses.
// httpbin.org/gzip returns gzip-compressed data.

async function testFetchGzip() {
    const response = await fetch('https://httpbin.org/gzip');

    assert.eq(response.status, 200, 'status should be 200');

    const data = await response.json();

    assert.ok(data.gzipped === true, 'response should indicate gzip was used');
}

// Test that fetch handles deflate compressed responses.
async function testFetchDeflate() {
    const response = await fetch('https://httpbin.org/deflate');

    assert.eq(response.status, 200, 'status should be 200');

    const data = await response.json();

    assert.ok(data.deflated === true, 'response should indicate deflate was used');
}

await testFetchGzip();
await testFetchDeflate();
