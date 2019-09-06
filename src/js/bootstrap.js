// quv internal bootstrap.
//

import * as quv from '@quv/core';

globalThis.quv = quv;
globalThis.setTimeout = quv.setTimeout;
globalThis.clearTimeout = quv.clearTimeout;
globalThis.setInterval = quv.setInterval;
globalThis.clearInterval = quv.clearInterval;

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
