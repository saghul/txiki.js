const core = globalThis.__bootstrap;

import { alert, confirm, prompt } from './alert-confirm-prompt.js';
import { open, mkstemp } from './fs.js';
import { signal } from './signal.js';
import { connect, listen } from './sockets.js';
import { createStdin, createStdout, createStderr } from './stdio.js';

import * as FFI from './ffi.js';

// The "tjs" global.
//

const tjs = Object.create(null);
const noExport = [
    'STDIN_FILENO',
    'STDOUT_FILENO',
    'STDERR_FILENO',
    'TCP_IPV6ONLY',
    'UDP_IPV6ONLY',
    'UDP_REUSEADDR',
    'Pipe',
    'TCP',
    'TTY',
    'UDP',
    'Worker',
    'XMLHttpRequest',
    'clearInterval',
    'clearTimeout',
    'evalScript',
    'guessHandle',
    'hrtimeMs',
    'mkstemp',
    'newStdioFile',
    'open',
    'random',
    'setInterval',
    'setTimeout',
    'signal',
    'signals',
    'wasm',
    'ffi' // is exported as import from ffi.js
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

tjs.ffi = FFI;
FFI.StructType.parseCProto = function(header){
    const ast = parseCProto(header);
    astToLib(this, ast);
}

// Alert, confirm, prompt.
// These differ slightly from browsers, they are async.
Object.defineProperty(tjs, 'alert', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: alert
});
Object.defineProperty(tjs, 'confirm', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: confirm
});
Object.defineProperty(tjs, 'prompt', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: prompt
});

// For the REPL.
Object.defineProperty(tjs, '_evalScript', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: core.evalScript
});

// FS.
Object.defineProperty(tjs, 'open', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: open
});
Object.defineProperty(tjs, 'mkstemp', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: mkstemp
});

// Signals.
Object.defineProperty(tjs, 'signal', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: signal
});

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
