const core = globalThis[Symbol.for('tjs.internal.core')];
const urlGetObjectURL = Symbol.for('tjs.internal.url.getObjectURL');
const blobGetParts = Symbol.for('tjs.internal.blob.getParts');
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
    constructor(specifier) {
        super();

        let source;
        let url;

        try {
            url = new URL(specifier);
        } catch (_) {
            // specifier is not an url
        }

        if (url && url.protocol === 'blob:') {
            const blob = URL[urlGetObjectURL](specifier);

            source = blobTextSync(blob);
        }

        const worker = new _Worker(specifier, source);
        const messagePipe = worker.messagePipe;

        messagePipe.onmessage = msg => {
            this.dispatchEvent(new MessageEvent('message', msg));
        };

        messagePipe.onmessageerror = msgerror => {
            this.dispatchEvent(new MessageEvent('messageerror', msgerror));
        };

        this[kWorker] = worker;
    }

    postMessage(message, transferOrOptions) {
        // Not using structuredClone here since we want to send the data directly
        // without creating a Uint8Array, but the behavior is equivalent.

        let options = {};

        if (Array.isArray(transferOrOptions)) {
            options = { transfer: transferOrOptions };
        } else if (typeof transferOrOptions === 'object') {
            options = transferOrOptions;
        }

        const transfers = options?.transfer ?? [];

        for (const t of transfers) {
            if (!core.isArrayBuffer(t)) {
                throw new DOMException('Transferrable is not an ArrayBuffer', 'DataCloneError');
            }
        }

        this[kWorker].messagePipe.postMessage(message);

        for (const t of transfers) {
            core.detachArrayBuffer(t);
        }
    }

    terminate() {
        this[kWorker].terminate();
    }

    get [Symbol.toStringTag]() {
        return 'Worker';
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
