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
    'runRepl',
    'setInterval',
    'setMaxStackSize',
    'setMemoryLimit',
    'setTimeout',
    'signal',
    'signals',
    'sleep',
    'wasm',
    'createObjectURL',
    'revokeObjectURL'
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

// Interface for the garbage collection
const _gc_state = {
    enabled: true,
    threshold: core._gc.getThreshold()
};

Object.defineProperty(tjs, 'gc', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: {
        run: () => core._gc.run(),

        set enabled(value) {
            if (value) {
                core._gc.setThreshold(_gc_state.threshold);
            } else {
                core._gc.setThreshold(-1);
            }

            _gc_state.enabled=value;
        },
        get enabled() {
            return _gc_state.enabled;
        },

        set threshold(value) {
            if (_gc_state.enabled) {
                core._gc.setThreshold(value);
            }

            _gc_state.threshold = value;
        },
        get threshold() {
            const tmp = core._gc.getThreshold();

            if (tmp !== -1) {
                _gc_state.threshold = tmp;
            }

            return _gc_state.threshold;
        },
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
