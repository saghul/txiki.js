const core = globalThis[Symbol.for('tjs.internal.core')];

import { alert, confirm, prompt } from './alert-confirm-prompt.js';
import env from './env.js';
import { open, makeDir, makeTempFile, remove } from './fs.js';
import { lookup } from './lookup.js';
import pathModule from './path.js';
import { addSignalListener, removeSignalListener } from './signal.js';
import { connect, listen } from './sockets.js';
import { createStdin, createStdout, createStderr } from './stdio.js';


// The "tjs" global.
//

const tjs = Object.create(null);
const noExport = [
    'AF_INET',
    'AF_INET6',
    'AF_UNSPEC',
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
    'getaddrinfo',
    'guessHandle',
    'isStdinTty',
    'isWorker',
    'mkdir',
    'mkstemp',
    'newStdioFile',
    'open',
    'posixSocketLoad',
    'random',
    'randomUUID',
    'rmdir',
    'runRepl',
    'setInterval',
    'setMaxStackSize',
    'setMemoryLimit',
    'setTimeout',
    'signal',
    'signals',
    'unlink',
    'wasm'
];

for (const key of Object.keys(core)) {
    if (key.startsWith('_')) {
        continue;
    }

    if (noExport.includes(key)) {
        continue;
    }

    Object.defineProperty(tjs, key, Object.getOwnPropertyDescriptor(core, key));
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
Object.defineProperty(tjs, 'makeDir', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: makeDir
});
Object.defineProperty(tjs, 'makeTempFile', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: makeTempFile
});
Object.defineProperty(tjs, 'remove', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: remove
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
Object.defineProperty(tjs, 'lookup', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: lookup
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
