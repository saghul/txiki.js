const core = globalThis[Symbol.for('tjs.internal.core')];

import { alert, confirm, prompt } from './alert-confirm-prompt.js';
import env from './env.js';
import { open, mkdir, mkstemp, rm } from './fs.js';
import pathModule from './path.js';
import { PosixSocket } from './posix-socket.js';
import { addSignalListener, removeSignalListener } from './signal.js';
import { connect, listen } from './sockets.js';
import { createStdin, createStdout, createStderr } from './stdio.js';

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
    'evalFile',
    'evalScript',
    'ffi_load_native',
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

// Environment.
Object.defineProperty(tjs, 'env', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: env
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
if (!core.isWorker) {
    Object.defineProperty(tjs, 'addSignalListener', {
        enumerable: true,
        configurable: false,
        writable: false,
        value: addSignalListener
    });
    Object.defineProperty(tjs, 'removeSignalListener', {
        enumerable: true,
        configurable: false,
        writable: false,
        value: removeSignalListener
    });
}

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

// Garbage Collection
// This code assumes no one else in the code will try to change the configuration for the gc.
// Changes of the threshold will not be backpropagated here.
const _gc_state = {
    enabled: true,
    threshold: core.gcGetThreshold()
};

Object.defineProperty(tjs, 'gc', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: {
        run: ()=>core.gcRun(),

        set enabled(value) {
            if (value===true) {
                core.gcSetThreshold(_gc_state.threshold);
            } else {
                core.gcSetThreshold(-1);
            }
        },
        get enabled() {
            return _gc_state.enabled;
        },

        set threshold(value) {
            if (_gc_state.enabled) {
                core.gcSetThreshold(value);_gc_state.threshold=value;
            } else {
                core.gcSetThreshold(-1);
            }
        },
        get threshold() {
            const tmp = core.gcGetThreshold();

            if (tmp!==-1) {
                _gc_state.threshold = tmp;
            }

            return tmp;
        },

        /**
         * @param {boolean} value
         */
        set fixThreshold(value) {
            core.gcFixThreshold(value);
        },

        /**
         * @param {()=>boolean} v If returning true the GC event will take place, otherwise it is skipped.
         */
        set onBefore(v) {
            core.gcSetBeforeCallback(v);
        },

        /**
         * @param {()=>void} v
         */
        set onAfter(v) {
            core.gcSetAfterCallback(v);
        }

    }
});

// Internal stuff needed by the runtime.
globalThis[Symbol.for('tjs.internal.modules.path')] = pathModule;

// tjs global.
Object.defineProperty(globalThis, 'tjs', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: Object.freeze(tjs)
});
