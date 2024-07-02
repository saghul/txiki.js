const core = globalThis[Symbol.for('tjs.internal.core')];
const urlGetObjectURL = globalThis[Symbol.for('tjs.internal.url.getObjectURL')];
const blobGetParts = globalThis[Symbol.for('tjs.internal.blob.getParts')];
const _Worker = core.Worker;

import { defineEventAttribute } from './event-target';

const kWorker = Symbol('kWorker');

function blobTextSync(blob) {
    if (!(blob instanceof Blob)) {
        return undefined;
    }

    const decoder = new TextDecoder();
    const partsStr = [];

    for (const part of blob[blobGetParts]) {
        if (part instanceof Blob) {
            partsStr.push(blobTextSync(part));
        } else {
            partsStr.push(decoder.decode(part, { stream: true }));
        }
    }

    partsStr.push(decoder.decode());

    return partsStr.join('');
}

class Worker extends EventTarget {
    constructor(path) {
        super();

        let source = undefined;
        let isObjectURL = new URLPattern({ protocol: 'blob:' });

        if (isObjectURL.exec(path) !== null) {
            const blob = URL[urlGetObjectURL](path);

            source = blobTextSync(blob);
        }

        const worker = new _Worker(path, source);

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
