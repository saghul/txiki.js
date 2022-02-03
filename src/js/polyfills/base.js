const core = globalThis.__bootstrap;

import queueMicrotask from 'queue-microtask';

globalThis.setTimeout = core.setTimeout;
globalThis.clearTimeout = core.clearTimeout;
globalThis.setInterval = core.setInterval;
globalThis.clearInterval = core.clearInterval;
globalThis.queueMicrotask = queueMicrotask;

Object.defineProperty(globalThis, 'global', {
    enumerable: true,
    get() { return globalThis },
    set() {}
});

Object.defineProperty(globalThis, 'window', {
    enumerable: true,
    get() { return globalThis },
    set() {}
});

Object.defineProperty(globalThis, 'self', {
    enumerable: true,
    get() { return globalThis },
    set() {}
});
