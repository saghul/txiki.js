// Terminates (or, with "parent-throw", abandons via an uncaught error) a worker
// that is stuck in a synchronous busy loop. The mode picks where the loop runs.
// The "drain-*" modes stop the worker while a threadpool digest is in flight,
// so the busy loop runs in its continuation, during the teardown drain.
const mode = tjs.args.at(-1);

const prelude = 'self.onerror = e => console.error(\'worker onerror\', e.message);'
    + 'self.onunhandledrejection = e => console.error(\'worker onunhandledrejection\', e.reason?.message);';
const drainBusy = 'crypto.subtle.digest(\'SHA-512\', new Uint8Array(64 << 20)).then(() => { for (;;) {} });'
    + 'self.postMessage(\'busy\');';
const sources = {
    'top-level': 'self.postMessage(\'busy\'); for (;;) {}',
    'onmessage': 'self.onmessage = () => { self.postMessage(\'busy\'); for (;;) {} };',
    'await': 'await new Promise(r => setTimeout(r, 0)); self.postMessage(\'busy\'); for (;;) {}',
    'parent-throw': 'self.postMessage(\'busy\'); for (;;) {}',
    'drain-terminate': drainBusy,
    'drain-close': drainBusy + 'self.close();',
};

const url = URL.createObjectURL(new Blob([ prelude + sources[mode] ], { type: 'text/javascript' }));
const w = new Worker(url);

URL.revokeObjectURL(url);

w.onerror = e => console.log('error event', e.message);

if (mode === 'parent-throw') {
    // Fatal (unlike a throw in an event listener, which is only reported), so
    // the parent tears down with the worker still busy.
    await new Promise(resolve => w.onmessage = resolve);
    throw new Error('boom');
}

if (mode === 'drain-close') {
    // The worker reaps itself; the message is delivered after the reap, and the
    // timer shows the parent loop is still running.
    w.onmessage = () => setTimeout(() => console.log('parent alive'), 10);
} else {
    w.onmessage = () => {
        w.terminate();
        console.log('terminate returned');
    };
}

if (mode === 'onmessage') {
    w.postMessage('go');
}
