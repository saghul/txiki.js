const core = globalThis.__bootstrap;

import { connect, listen } from './sockets.js';
import { createStdin, createStdout, createStderr } from './stdio.js';

// The "tjs" global.
//

const tjs = Object.create(null);
const noExport = [
    'Pipe',
    'TCP',
    'TTY',
    'UDP',
    'Worker',
    'XMLHttpRequest',
    'clearInterval',
    'clearTimeout',
    'guessHandle',
    'hrtimeMs',
    'random',
    'setInterval',
    'setTimeout',
    'wasm'
];

for (const [key, value] of Object.entries(core)) {
    if (noExport.includes(key)) {
        continue;
    }

    tjs[key] = value;
}

// These values should be immutable.
tjs.args = Object.freeze(core.args);
tjs.versions = Object.freeze(core.versions);

// Sockets.
Object.defineProperty(tjs, 'connect', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: connect
});
Object.defineProperty(tjs, 'listen', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: listen
});

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
