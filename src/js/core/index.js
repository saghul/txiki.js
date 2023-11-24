const core = globalThis.__bootstrap;

import { alert, confirm, prompt } from './alert-confirm-prompt.js';
import { open, mkdir, mkstemp, rm } from './fs.js';
import pathModule from './path.js';
import { PosixSocket } from './posix-socket.js';
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
    'WebSocket',
    'Worker',
    'XMLHttpRequest',
    'clearInterval',
    'clearTimeout',
    'environ',
    'evalFile',
    'evalScript',
    'ffi',
    'guessHandle',
    'isStdinTty',
    'mkdir',
    'mkstemp',
    'newStdioFile',
    'open',
    'posix_socket',
    'random',
    'randomUUID',
    'setInterval',
    'setMaxStackSize',
    'setMemoryLimit',
    'setTimeout',
    'signal',
    'signals',
    'sleep',
    'wasm'
];

for (const [ key, value ] of Object.entries(core)) {
    if (key.startsWith('_')) {
        continue;
    }

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

// Getters.
Object.defineProperty(tjs, 'environ', {
    enumerable: true,
    configurable: false,
    get() {
        return core.environ();
    }
});
Object.defineProperty(tjs, 'pid', {
    enumerable: true,
    configurable: false,
    get() {
        return core.getPid();
    }
});
Object.defineProperty(tjs, 'ppid', {
    enumerable: true,
    configurable: false,
    get() {
        return core.getPpid();
    }
});

// FS.
Object.defineProperty(tjs, 'open', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: open
});
Object.defineProperty(tjs, 'mkdir', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: mkdir
});
Object.defineProperty(tjs, 'mkstemp', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: mkstemp
});
Object.defineProperty(tjs, 'rm', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: rm
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

// PosixSocket.
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

tjs[kInternal] = Object.create(null);
tjs[kInternal]['bootstrapWorker'] = bootstrapWorker;
tjs[kInternal]['core'] = core;
tjs[kInternal]['pathModule'] = pathModule;

// tjs global.
Object.defineProperty(globalThis, 'tjs', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: Object.freeze(tjs)
});
