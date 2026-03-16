import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, baseUrl } = createEchoServer();

// Response body as ReadableStream can be consumed via text()
const response = await fetch(`${baseUrl}/get`);
const text = await response.text();

assert.eq(typeof text, 'string', 'text() returns string');
assert.ok(text.length > 0, 'text has content');

server.close();
