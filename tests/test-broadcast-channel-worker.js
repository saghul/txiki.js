import assert from 'tjs:assert';
import path from 'tjs:path';

// BroadcastChannel fans out across worker threads: the main thread broadcasts to
// a named channel and workers subscribed to that name receive it (and vice versa).

const helper = path.join(import.meta.dirname, 'helpers', 'broadcast-channel-worker.js');
const bc = new BroadcastChannel('cluster');
const w1 = new Worker(helper);
const w2 = new Worker(helper);

// Wait for both workers to be ready before broadcasting.
await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for workers')), 5000);
    let ready = 0;
    const onReady = () => {
        if (++ready === 2) {
            clearTimeout(timer);
            resolve();
        }
    };

    w1.onmessage = onReady;
    w2.onmessage = onReady;
});

const pongs = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for pongs')), 5000);
    const acc = [];

    bc.onmessage = e => {
        acc.push(e.data);

        if (acc.length === 2) {
            clearTimeout(timer);
            resolve(acc);
        }
    };

    bc.postMessage('ping');
});

assert.eq(pongs.length, 2, 'both workers responded over the BroadcastChannel');
assert.ok(pongs.every(p => p === 'pong'), 'responses are pongs');

bc.postMessage('stop');
bc.close();
w1.terminate();
w2.terminate();
