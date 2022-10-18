import { Blob } from 'blob-polyfill';

Object.defineProperty(window, 'Blob', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Blob
});
