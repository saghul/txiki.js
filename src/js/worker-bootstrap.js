
import { defineEventAttribute } from '@tjs/event-target';

// `workerThis` is a reference to a tjs/core `Worker` objet.

const kWorkerSelf = Symbol('kWorkerSelf');

const worker = globalThis.workerThis;
delete globalThis.workerThis;

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
