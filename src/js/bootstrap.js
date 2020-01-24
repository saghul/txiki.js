// tjs internal bootstrap.
//

import * as core from '@tjs/core';

globalThis.setTimeout = core.setTimeout;
globalThis.clearTimeout = core.clearTimeout;
globalThis.setInterval = core.setInterval;
globalThis.clearInterval = core.clearInterval;
globalThis.alert = core.alert;
globalThis.prompt = core.prompt;

Object.defineProperty(globalThis, 'global', {
    enumerable: true,
    get() { return globalThis },
    set() {}
});

Object.defineProperty(globalThis, 'window', {
    enumerable: true,
    get() { return globalThis },
    set() {}
});

// The "tjs" global.
//

const tjs = Object.create(null);
const noExport = [
    'setTimeout',
    'setInterval',
    'clearTimeout',
    'clearInterval',
    'alert',
    'prompt',
    'XMLHttpRequest',
    'Worker',
    'signal',
    'random',
    'args',
    'versions'
];

tjs.signal = core.signal;

for (const [key, value] of Object.entries(core)) {
    if (noExport.indexOf(key) !== -1) {
        continue;
    }

    // tjs.signal.SIGINT etc.
    if (key.startsWith('SIG')) {
        tjs.signal[key] = value;
        continue;
    }

    tjs[key] = value;
}

// These values should be immutable.
tjs.args = Object.freeze(core.args);
tjs.versions = Object.freeze(core.versions);

Object.defineProperty(globalThis, 'tjs', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: tjs
});
