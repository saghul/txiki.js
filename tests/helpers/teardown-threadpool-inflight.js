// Die on an uncaught error while threadpool work this runtime started (a digest,
// a file write and DNS lookups) is still running.
// Usage: teardown-threadpool-inflight.js <dir>

import path from 'tjs:path';

const data = new Uint8Array(8 * 1024 * 1024);

crypto.subtle.digest('SHA-512', data);

const f = await tjs.open(path.join(tjs.args[3], 'out'), 'w');

f.write(data);

for (let i = 0; i < 64; i++) {
    tjs.lookup('localhost').catch(() => {});
}

throw new Error('teardown with threadpool work in flight');
