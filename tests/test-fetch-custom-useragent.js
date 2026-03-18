import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, baseUrl } = createEchoServer();

// Custom User-Agent should replace the default one.
async function testCustomUserAgent() {
    const resp = await fetch(`${baseUrl}/get`, {
        headers: { 'User-Agent': 'MyCustomAgent/1.0' },
    });
    const data = await resp.json();

    assert.eq(data.headers['user-agent'], 'MyCustomAgent/1.0', 'custom user-agent is sent');
}

// When no User-Agent is set, the default should be present.
async function testDefaultUserAgent() {
    const resp = await fetch(`${baseUrl}/get`);
    const data = await resp.json();

    assert.ok(data.headers['user-agent'], 'default user-agent is set');
    assert.ok(data.headers['user-agent'].startsWith('txiki.js/'), 'default user-agent starts with txiki.js/');
}

await testCustomUserAgent();
await testDefaultUserAgent();

server.close();
