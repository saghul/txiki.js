import assert from 'tjs:assert';
import path from 'tjs:path';

// A MessagePort can be transferred into a Worker and used for direct
// bidirectional communication over a dedicated channel.

const worker = new Worker(path.join(import.meta.dirname, 'helpers', 'message-port-worker.js'));
const { port1, port2 } = new MessageChannel();

const echoes = [];
let gotPortConfirmation = false;

await new Promise((resolve, reject) => {
    // Generous watchdog: worker startup + a port round-trip is slow under GC
    // stress (a full GC before every allocation). This is not a timing assertion.
    const timer = setTimeout(() => reject(new Error('timeout')), 30000);

    worker.onmessage = e => {
        if (e.data === 'got-port') {
            gotPortConfirmation = true;
        }
    };

    port1.onmessage = e => {
        echoes.push(e.data);

        if (e.data === 'echo:done') {
            clearTimeout(timer);
            resolve();
        }
    };

    // Hand port2 to the worker; keep port1 here.
    worker.postMessage({ note: 'here is your port' }, [ port2 ]);
    port1.postMessage('hi');
    port1.postMessage('done');
});

assert.ok(gotPortConfirmation, 'worker confirmed receipt of the transferred port');
assert.ok(echoes.includes('echo:hi'), 'worker echoed first message over the port');
assert.ok(echoes.includes('echo:done'), 'worker echoed final message over the port');

// The transferred port is detached on this side.
assert.throws(() => port2.postMessage('x'), Error, 'transferred port detached on sender');

port1.close();
worker.terminate();
