const navigator = {};

Object.defineProperty(navigator, 'userAgent', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: 'txiki.js'
});

Object.defineProperty(globalThis, 'navigator', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: navigator
});
