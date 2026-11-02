// Concurrent fetches to a port nobody listens on: the first one's connection
// fails, and the fetches queued behind it get one attempt of their own each,
// which fails too. All of them must reject with a TypeError, promptly; a
// queued fetch must never retry in a loop.
import assert from 'tjs:assert';

import { withWatchdog } from './helpers/delayed-h1-server.js';

const listener = await tjs.listen('tcp', '127.0.0.1', 0);
const { localPort: port } = await listener.opened;

await listener.close();

const url = `http://127.0.0.1:${port}/`;
const settle = p => p.then(r => `status ${r.status}`, e => e.name);
const results = await withWatchdog(Promise.all([ 0, 1, 2, 3 ].map(() => settle(fetch(url)))), 'fetches');

assert.eq(results.join(','), 'TypeError,TypeError,TypeError,TypeError', 'every fetch failed');
