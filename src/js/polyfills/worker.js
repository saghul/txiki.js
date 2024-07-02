const core = globalThis[Symbol.for('tjs.internal.core')];
const _Worker = core.Worker;

import { kBlobGetParts } from './blob';
import { defineEventAttribute } from './event-target';
import { kGetObjectURL } from './url';

const kWorker = Symbol('kWorker');

function blobTextSync(blob) {
    const decoder = new TextDecoder();
    let str = '';

    for (const part of blob[kBlobGetParts]) {
        if (part instanceof Blob) {
            str += blobTextSync(part);
        } else {
            str += decoder.decode(part, { stream: true });
        }
    }

    str += decoder.decode();

    return str;
}

class Worker extends EventTarget {
    constructor(path) {
        super();

        const blob = URL[kGetObjectURL](path);
        const blob_text = blob ? blobTextSync(blob) : undefined;
        const worker = new _Worker(path, blob_text);

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
