import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, baseUrl } = createEchoServer();

// Early header access - headers available before body complete
const response = await fetch(`${baseUrl}/get`);

// Headers should be available immediately after fetch resolves
assert.ok(response.headers instanceof Headers, 'headers are available');
assert.ok(response.headers.get('content-type'), 'content-type header exists');
assert.eq(response.status, 200, 'status is available');

// Body should still be readable
const data = await response.json();

assert.ok(data, 'body is readable');

server.close();
