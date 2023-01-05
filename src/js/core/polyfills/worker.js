const { Worker: _Worker } = globalThis.__bootstrap;

import { defineEventAttribute } from '@tjs/internal/polyfill/event-target';

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

    postMessage(...args) {
        this[kWorker].postMessage(args);
    }

    terminate() {
        this[kWorker].terminate();
    }
}

const workerProto = Worker.prototype;

defineEventAttribute(workerProto, 'message');
defineEventAttribute(workerProto, 'messageerror');
defineEventAttribute(workerProto, 'error');

export {
    Worker
};