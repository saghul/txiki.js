import * as core from '@tjs/core';

globalThis.setTimeout = core.setTimeout;
globalThis.clearTimeout = core.clearTimeout;
globalThis.setInterval = core.setInterval;
globalThis.clearInterval = core.clearInterval;
globalThis.alert = core.alert;
globalThis.prompt = core.prompt;

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
