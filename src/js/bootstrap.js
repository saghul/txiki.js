// tjs internal bootstrap.
//

import * as tjs from '@tjs/core';

globalThis.tjs = tjs;
globalThis.setTimeout = tjs.setTimeout;
globalThis.clearTimeout = tjs.clearTimeout;
globalThis.setInterval = tjs.setInterval;
globalThis.clearInterval = tjs.clearInterval;
globalThis.XMLHttpRequest = tjs.XMLHttpRequest;

Object.defineProperty(globalThis, 'global', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: globalThis
});

Object.defineProperty(globalThis, 'window', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: globalThis
});
