import * as core from '@tjs/core';
import { createStdin, createStdout, createStderr } from './stdio.js';

// The "tjs" global.
//

const tjs = Object.create(null);
const noExport = [
    'setTimeout',
    'setInterval',
    'clearTimeout',
    'clearInterval',
    'guessHandleType',
    'alert',
    'prompt',
    'XMLHttpRequest',
    'Worker',
    'signal',
    'random',
    'args',
    'versions',
    'wasm'
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

// Stdio.
Object.defineProperty(tjs, 'stdin', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: createStdin()
});
Object.defineProperty(tjs, 'stdout', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: createStdout()
});
Object.defineProperty(tjs, 'stderr', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: createStderr()
});

// tjs global.
Object.defineProperty(globalThis, 'tjs', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: Object.freeze(tjs)
});
