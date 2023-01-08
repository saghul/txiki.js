const core = globalThis.__bootstrap;

import queueMicrotask from 'queue-microtask';

globalThis.setTimeout = core.setTimeout;
globalThis.clearTimeout = core.clearTimeout;
globalThis.setInterval = core.setInterval;
globalThis.clearInterval = core.clearInterval;
globalThis.queueMicrotask = queueMicrotask;

const noop = () => {};

function defineLazyProperties(obj, module, moduleKeys, propertyKeys = []) {
    let mod;

    for (let i = 0; i < moduleKeys.length; i++) {
        let key = moduleKeys[i];
        let propertyKey = propertyKeys[i] || key;

        Object.defineProperty(obj, propertyKey, {
            enumerable: true,
            get: () => {
                mod ??= core.require(module);

                return mod[key];
            },
            set: noop,
        });
    }
}

Object.defineProperty(core, 'defineLazyProperties', {
    enumerable: true,
    writable: false,
    configurable: false,
    value: defineLazyProperties,
});

Object.defineProperty(globalThis, 'global', {
    enumerable: true,
    get() {
        return globalThis;
    },
    set() {},
});

Object.defineProperty(globalThis, 'window', {
    enumerable: true,
    get() {
        return globalThis;
    },
    set() {},
});

Object.defineProperty(globalThis, 'self', {
    enumerable: true,
    get() {
        return globalThis;
    },
    set() {},
});
