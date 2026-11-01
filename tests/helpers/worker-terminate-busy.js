// Terminates (or, with "parent-throw", abandons via an uncaught error) a worker
// that is stuck in a synchronous busy loop. The mode picks where the loop runs.
const mode = tjs.args.at(-1);

const prelude = 'self.onerror = e => console.error(\'worker onerror\', e.message);'
    + 'self.onunhandledrejection = e => console.error(\'worker onunhandledrejection\', e.reason?.message);';
const sources = {
    'top-level': 'self.postMessage(\'busy\'); for (;;) {}',
    'onmessage': 'self.onmessage = () => { self.postMessage(\'busy\'); for (;;) {} };',
    'await': 'await new Promise(r => setTimeout(r, 0)); self.postMessage(\'busy\'); for (;;) {}',
    'parent-throw': 'self.postMessage(\'busy\'); for (;;) {}',
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

w.onmessage = () => {
    w.terminate();
    console.log('terminate returned');
};

if (mode === 'onmessage') {
    w.postMessage('go');
}
