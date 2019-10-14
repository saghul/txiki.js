
import { defineEventAttribute } from '@quv/event-target';

// `workerThis` is a reference to a quv/core `Worker` objet.

const kWorkerSelf = Symbol('kWorkerSelf');

const worker = globalThis.workerThis;
delete globalThis.workerThis;

Object.defineProperty(globalThis, 'self', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: globalThis
});

self[kWorkerSelf] = worker;
worker.onmessage = msg => {
    self.dispatchEvent(new MessageEvent('message', msg));
};
worker.onmessageerror = msgerror => {
    self.dispatchEvent(new MessageEvent('messageerror', msgerror));
};
worker.onerror = error => {
    self.dispatchEvent(new ErrorEvent(error));
};
self.postMessage = (...args) => {
    return self[kWorkerSelf].postMessage(...args);
}

defineEventAttribute(Object.getPrototypeOf(self), 'message');
defineEventAttribute(Object.getPrototypeOf(self), 'messageerror');
defineEventAttribute(Object.getPrototypeOf(self), 'error');
