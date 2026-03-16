import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, baseUrl } = createEchoServer();

// Response body as ReadableStream can be consumed via arrayBuffer()
const response = await fetch(`${baseUrl}/get`);
const buffer = await response.arrayBuffer();

assert.ok(buffer instanceof ArrayBuffer, 'arrayBuffer() returns ArrayBuffer');
assert.ok(buffer.byteLength > 0, 'buffer has data');

server.close();
