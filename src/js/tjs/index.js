const core = globalThis.__bootstrap;

import { alert, confirm, prompt } from './alert-confirm-prompt.js';
import { evalStdin } from './eval-stdin.js';
import * as FFI from './ffi.js';
import { open, mkstemp } from './fs.js';
import { PosixSocket } from './posix-socket.js';
import { runRepl } from './repl.js';
import { signal } from './signal.js';
import { connect, listen } from './sockets.js';
import { createStdin, createStdout, createStderr } from './stdio.js';
import { bootstrapWorker } from './worker-bootstrap.js';


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
    'evalFile',
    'evalScript',
    'ffi',
    'guessHandle',
    'hrtimeMs',
    'isStdinTty',
    'mkstemp',
    'newStdioFile',
    'open',
    'posix_socket',
    'random',
    'setInterval',
    'setTimeout',
    'signal',
    'signals',
    'wasm'
];

for (const [ key, value ] of Object.entries(core)) {
    if (noExport.includes(key)) {
        continue;
    }

    tjs[key] = value;
}

// These values should be immutable.
tjs.args = Object.freeze(core.args);
tjs.versions = Object.freeze(core.versions);

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

// FFI
Object.defineProperty(tjs, 'ffi', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: FFI
});

if (core.posix_socket) {
    Object.defineProperty(tjs, 'PosixSocket', {
        enumerable: true,
        configurable: false,
        writable: false,
        value: PosixSocket
    });
}

// Internal stuff needed by the runtime.
const kInternal = Symbol.for('tjs.internal');
const internals = [ 'evalFile', 'evalScript', 'isStdinTty' ];

tjs[kInternal] = Object.create(null);

for (const propName of internals) {
    tjs[kInternal][propName] = core[propName];
}

tjs[kInternal]['bootstrapWorker'] = bootstrapWorker;
tjs[kInternal]['evalStdin'] = evalStdin;
tjs[kInternal]['runRepl'] = runRepl;

// tjs global.
Object.defineProperty(globalThis, 'tjs', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: Object.freeze(tjs)
});
