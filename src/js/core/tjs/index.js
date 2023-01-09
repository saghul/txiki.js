const core = globalThis.__bootstrap;

import '../polyfills/base';
import '../polyfills/event-target-polyfill';
import { createStdin, createStdout, createStderr } from './stdio.js';

const defineLazyProperties = core.defineLazyProperties;

// The "tjs" global.
const tjs = Object.create(null);

const noExport = new Set([
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
    'environ',
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
    'setMaxStackSize',
    'setMemoryLimit',
    'setTimeout',
    'signal',
    'signals',
    'wasm',
]);

for (const [ key, value ] of Object.entries(core)) {
    if (noExport.has(key)) {
        continue;
    }

    tjs[key] = value;
}

// These values should be immutable.
tjs.args = Object.freeze(core.args);
tjs.versions = Object.freeze(core.versions);

// Alert, confirm, prompt.
// These differ slightly from browsers, they are async.
defineLazyProperties(tjs, '@tjs/alert-confirm-prompt', [
    'alert',
    'confirm',
    'prompt',
]);

// Getters.
Object.defineProperty(tjs, 'environ', {
    enumerable: true,
    configurable: false,
    get() {
        return core.environ();
    },
});
Object.defineProperty(tjs, 'pid', {
    enumerable: true,
    configurable: false,
    get() {
        return core.getPid();
    },
});
Object.defineProperty(tjs, 'ppid', {
    enumerable: true,
    configurable: false,
    get() {
        return core.getPpid();
    },
});

// FS.
defineLazyProperties(tjs, '@tjs/fs', [ 'open', 'mkstemp' ]);

// Signals.
defineLazyProperties(tjs, '@tjs/signal', [ 'signal' ]);

// Sockets.
defineLazyProperties(tjs, '@tjs/sockets', [ 'connect', 'listen' ]);

// FFI
Object.defineProperty(tjs, 'ffi', {
    enumerable: true,
    get: () => core.require('@tjs/ffi'),
    set: () => {},
});

if (core.posix_socket) {
    defineLazyProperties(tjs, '@tjs/posix-socket', [ 'PosixSocket' ]);
}

// Stdio.
Object.defineProperty(tjs, 'stdin', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: createStdin(),
});
Object.defineProperty(tjs, 'stdout', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: createStdout(),
});
Object.defineProperty(tjs, 'stderr', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: createStderr(),
});

Object.defineProperty(tjs, 'textEncode', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: core.textEncode,
});

Object.defineProperty(tjs, 'textDecode', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: core.textDecode,
});

function getCircularReplacer() {
    const seen = new WeakSet();

    return (_, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return;
            }

            seen.add(value);
        }

        return value;
    };
}

function format(...args) {
    return args
        .map(a => {
            const type = typeof a;

            switch (type) {
                case 'undefined':
                    return 'undefined';
                case 'object':
                    if (a instanceof Error) {
                        return `${a.name}: ${a.message}\n${a.stack}`;
                    }

                    return JSON.stringify(a, getCircularReplacer(), 2);
                case 'function':
                    return `[function: ${a.name || '(anonymous)'}]`;
            }

            return a.toString();
        })
        .join(' ');
}

function print(...args) {
    const text = `${format(...args)}\n`;

    tjs.stdout.write(core.textEncode(text));
}

const console = {
    log: print,
    info: print,
    warn: print,
    error: print,
    assert: (expression, ...args) => {
        if (!expression) {
            print(...args);
        }
    },
    dir: print,
    dirxml: print,
    __format: format
};

Object.defineProperty(globalThis, 'console', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: console,
});

defineLazyProperties(console, '@tjs/internal/polyfill/console', [
    'table',
    'trace',
]);

// // Internal stuff needed by the runtime.
const kInternal = Symbol.for('tjs.internal');
const internals = [
    'require',
    'evalFile',
    'evalScript',
    'isStdinTty',
    'setMaxStackSize',
    'setMemoryLimit',
];

tjs[kInternal] = Object.create(null);
const internalObj = tjs[kInternal];

for (const propName of internals) {
    internalObj[propName] = core[propName];
}

defineLazyProperties(internalObj, '@tjs/repl', [ 'runRepl' ]);
defineLazyProperties(internalObj, '@tjs/run-tests', [ 'runTests' ]);
defineLazyProperties(internalObj, '@tjs/worker-bootstrap', [ 'bootstrapWorker' ]);

// tjs global.
Object.defineProperty(globalThis, 'tjs', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: Object.freeze(tjs),
});

// polyfills
// URL
defineLazyProperties(globalThis, '@tjs/internal/polyfill/url', [
    'URL',
    'URLSearchParams',
]);

// URLPattern
defineLazyProperties(globalThis, '@tjs/internal/polyfill/url-pattern', [
    'URLPattern',
]);

// XHR
defineLazyProperties(globalThis, '@tjs/internal/polyfill/xhr', [
    'XMLHttpRequest',
]);

// fetch
defineLazyProperties(globalThis, '@tjs/internal/polyfill/whatwg-fetch', [
    'Headers',
    'Request',
    'Response',
    'fetch',
]);
defineLazyProperties(globalThis, '@tjs/internal/polyfill/abortcontroller', [
    'AbortController',
]);

// web streams
defineLazyProperties(globalThis, '@tjs/internal/polyfill/web-streams', [
    'ByteLengthQueuingStrategy',
    'CountQueuingStrategy',
    'ReadableByteStreamController',
    'ReadableStream',
    'ReadableStreamBYOBReader',
    'ReadableStreamBYOBRequest',
    'ReadableStreamDefaultController',
    'ReadableStreamDefaultReader',
    'TransformStream',
    'TransformStreamDefaultController',
    'WritableStream',
    'WritableStreamDefaultController',
    'WritableStreamDefaultWriter',
]);

// text encoding (remove in favor of encoding from qjs?)
defineLazyProperties(globalThis, '@tjs/internal/polyfill/text-encoding', [
    'TextEncoder',
    'TextDecoder',
]);

// blob
defineLazyProperties(globalThis, '@tjs/internal/polyfill/blob', [ 'Blob' ]);

// crypto
defineLazyProperties(globalThis, '@tjs/internal/polyfill/crypto', [ 'crypto' ]);

// performance
defineLazyProperties(globalThis, '@tjs/internal/polyfill/performance', [
    'performance',
]);

// wasm
defineLazyProperties(
    globalThis,
    '@tjs/internal/polyfill/wasm',
    [ 'WebAssemblyInstance' ],
    [ 'WebAssembly' ]
);

// worker
defineLazyProperties(globalThis, '@tjs/internal/polyfill/worker', [ 'Worker' ]);

// ws
defineLazyProperties(globalThis, '@tjs/internal/polyfill/ws', [ 'WebSocket' ]);
