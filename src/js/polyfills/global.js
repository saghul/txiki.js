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
