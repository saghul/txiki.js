import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, baseUrl } = createEchoServer();

// Response body as ReadableStream can be consumed via blob()
const response = await fetch(`${baseUrl}/get`);
const blob = await response.blob();

assert.ok(blob instanceof Blob, 'blob() returns Blob');
assert.ok(blob.size > 0, 'blob has data');

server.close();
