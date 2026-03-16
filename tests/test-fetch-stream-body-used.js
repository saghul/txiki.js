import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, baseUrl } = createEchoServer();

// Body can only be read once
const response = await fetch(`${baseUrl}/get`);
await response.text();

let threw = false;

try {
    await response.text();
} catch (e) {
    threw = true;
    assert.ok(e instanceof TypeError, 'throws TypeError');
}

assert.ok(threw, 'reading body twice throws');
assert.ok(response.bodyUsed, 'bodyUsed is true');

server.close();
