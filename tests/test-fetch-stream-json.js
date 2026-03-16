import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, baseUrl } = createEchoServer();

// Response body as ReadableStream can be consumed via json()
const response = await fetch(`${baseUrl}/get`);
const json = await response.json();

assert.eq(typeof json, 'object', 'json() returns object');
assert.ok(json.url, 'json has url property');

server.close();
