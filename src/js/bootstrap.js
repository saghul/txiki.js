// tjs internal bootstrap.
//

import * as tjs from '@tjs/core';

globalThis.tjs = tjs;
globalThis.setTimeout = tjs.setTimeout;
globalThis.clearTimeout = tjs.clearTimeout;
globalThis.setInterval = tjs.setInterval;
globalThis.clearInterval = tjs.clearInterval;
globalThis.alert = tjs.alert;
globalThis.prompt = tjs.prompt;

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
