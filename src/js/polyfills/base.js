import './timers.js';

import queueMicrotask from 'queue-microtask';

globalThis.queueMicrotask = queueMicrotask;

Object.defineProperty(globalThis, 'global', {
    enumerable: true,
    get() {
        return globalThis;
    },
    set() {}
});

Object.defineProperty(globalThis, 'window', {
    enumerable: true,
    get() {
        return globalThis;
    },
    set() {}
});

Object.defineProperty(globalThis, 'self', {
    enumerable: true,
    get() {
        return globalThis;
    },
    set() {}
});
