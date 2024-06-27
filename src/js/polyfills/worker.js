const core = globalThis[Symbol.for('tjs.internal.core')];
const _Worker = core.Worker;

import { defineEventAttribute } from './event-target';

const kWorker = Symbol('kWorker');

class Worker extends EventTarget {
    constructor(path) {
        super();

        const worker = new _Worker(path);

        worker.onmessage = msg => {
            this.dispatchEvent(new MessageEvent('message', msg));
        };

        worker.onmessageerror = msgerror => {
            this.dispatchEvent(new MessageEvent('messageerror', msgerror));
        };

        worker.onerror = error => {
            this.dispatchEvent(new ErrorEvent(error));
        };

        this[kWorker] = worker;
    }

    postMessage(message) {
        this[kWorker].postMessage(message);
    }

    terminate() {
        this[kWorker].terminate();
    }
}

const workerProto = Worker.prototype;

defineEventAttribute(workerProto, 'message');
defineEventAttribute(workerProto, 'messageerror');
defineEventAttribute(workerProto, 'error');

Object.defineProperty(window, 'Worker', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Worker
});
