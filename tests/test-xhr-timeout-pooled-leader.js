// A request queued on another request's connection must survive that request
// timing out: the XHR `timeout` closes the leader's connection, and the fetch
// waiting behind it, which was never sent, gets a connection of its own.
import assert from 'tjs:assert';

import { startDelayedServer, withWatchdog } from './helpers/delayed-h1-server.js';

// The leader's response comes too late for its timeout; the follower's is prompt.
const { server, base, state } = await startDelayedServer(path => (path === '/leader' ? 2000 : 50));

const leader = new Promise(resolve => {
    const xhr = new XMLHttpRequest();

    xhr.timeout = 300;
    xhr.ontimeout = () => resolve('timeout');
    xhr.onload = () => resolve(`load ${xhr.responseText}`);
    xhr.onerror = () => resolve('error');
    xhr.open('GET', `${base}/leader`);
    xhr.send();
});

// Let the leader's request go out first, so the fetch queues behind it.
await new Promise(r => setTimeout(r, 50));

const follower = fetch(`${base}/follower`).then(r => r.text(), e => `${e.name}: ${e.message}`);

try {
    const [ l, f ] = await withWatchdog(Promise.all([ leader, follower ]), 'requests');

    assert.eq(l, 'timeout', 'the leader timed out');
    assert.eq(f, 'ok /follower', 'the queued fetch got its body');
    assert.eq(state.connections, 2, 'the queued fetch went out on a connection of its own');
} finally {
    await server.close();
}
