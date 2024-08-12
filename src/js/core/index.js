const core = globalThis[Symbol.for('tjs.internal.core')];

import { alert, confirm, prompt } from './alert-confirm-prompt.js';
import engine from './engine.js';
import env from './env.js';
import { open, makeDir, makeTempFile, remove } from './fs.js';
import { lookup } from './lookup.js';
import pathModule from './path.js';
import { addSignalListener, removeSignalListener } from './signal.js';
import { connect, listen } from './sockets.js';
import { createStdin, createStdout, createStderr } from './stdio.js';
import system from './system.js';


// The "tjs" global.
//

const tjs = Object.create(null);

// Export these properties directly from the core.
const exports = [
    'Error',
    'chdir',
    'chmod',
    'chown',
    'copyFile',
    'createConsole',
    'cwd',
    'exePath',
    'exec',
    'exit',
    'format',
    'homeDir',
    'hostName',
    'inspect',
    'kill',
    'lchown',
    'lstat',
    'lutime',
    'makeTempDir',
    'pid',
    'ppid',
    'readDir',
    'readFile',
    'realPath',
    'rename',
    'spawn',
    'stat',
    'tmpDir',
    'utime',
    'version',
    'watch'
];

for (const key of exports) {
    Object.defineProperty(tjs, key, Object.getOwnPropertyDescriptor(core, key));
}

// These values should be immutable.
tjs.args = Object.freeze(core.args);

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

// Engine.
Object.defineProperty(tjs, 'engine', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: engine
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

// System.
Object.defineProperty(tjs, 'system', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: system
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
