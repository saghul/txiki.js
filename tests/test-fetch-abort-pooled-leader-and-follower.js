// A queued fetch whose leader's connection was aborted gets one more attempt
// on a connection of its own. Aborting it around that point, in the same tick
// as the leader or shortly after, must reject only that fetch: the others
// still succeed.
import assert from 'tjs:assert';

import { startDelayedServer, withWatchdog } from './helpers/delayed-h1-server.js';

const { server, base } = await startDelayedServer(() => 100);
const settle = p => p.then(r => r.text()).then(t => t, e => e.name);
const later = {
    'same tick': fn => fn(),
    microtask: fn => queueMicrotask(fn),
    'timeout 0': fn => setTimeout(fn, 0),
    'timeout 5': fn => setTimeout(fn, 5),
};

for (const [ when, schedule ] of Object.entries(later)) {
    for (const leaderAbortAfter of [ 0, 40 ]) {
        const what = `leader aborted after ${leaderAbortAfter} ms, follower ${when}`;
        const leaderAc = new AbortController();
        const followerAc = new AbortController();
        const leader = settle(fetch(`${base}/leader`, { signal: leaderAc.signal }));
        const f1 = settle(fetch(`${base}/f1`));
        const f2 = settle(fetch(`${base}/f2`, { signal: followerAc.signal }));
        const f3 = settle(fetch(`${base}/f3`));

        await new Promise(r => setTimeout(r, leaderAbortAfter));
        leaderAc.abort();
        schedule(() => followerAc.abort());

        const results = await withWatchdog(Promise.all([ leader, f1, f2, f3 ]), what);

        assert.eq(results.join(','), 'AbortError,ok /f1,AbortError,ok /f3', what);
    }
}

await server.close();
