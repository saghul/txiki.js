import core from 'tjs:internal/core';

import { getBlobParts } from './blob.js';
import { defineEventAttribute } from './event-target';
import { createPort, postMessageWithTransfer, DELIVER_ERROR, DELIVER_MESSAGE_ERROR } from './message-channel.js';
import { getObjectURL } from './url.js';

const _Worker = core.Worker;

function blobTextSync(blob) {
    if (!(blob instanceof Blob)) {
        return undefined;
    }

    const decoder = new TextDecoder();
    const partsStr = [];

    for (const part of getBlobParts(blob)) {
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
    #worker;
    #handle;

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
            const blob = getObjectURL(specifier);

            source = blobTextSync(blob);
        }

        const worker = new _Worker(specifier, source);
        const handle = worker.messagePipe;

        // The Worker always listens (start() is not gated on a 'message' handler).
        handle.start((data, ports, kind) => {
            if (kind === DELIVER_ERROR) {
                const error = new Error(data?.message ?? 'uncaught error in worker');

                if (data?.name) {
                    error.name = data.name;
                }

                if (data?.stack) {
                    error.stack = data.stack;
                }

                this.dispatchEvent(new ErrorEvent('error', { message: error.message, error }));

                return;
            }

            if (kind === DELIVER_MESSAGE_ERROR) {
                this.dispatchEvent(new MessageEvent('messageerror', {}));

                return;
            }

            this.dispatchEvent(new MessageEvent('message', { data, ports: ports?.map(createPort) }));
        });

        this.#worker = worker;
        this.#handle = handle;
    }

    postMessage(message, transferOrOptions) {
        postMessageWithTransfer(this.#handle, message, transferOrOptions, null);
    }

    terminate() {
        this.#worker.terminate();
    }

    [Symbol.dispose]() {
        this.#worker.terminate();
    }

    get [Symbol.toStringTag]() {
        return 'Worker';
    }
}

const workerProto = Worker.prototype;

defineEventAttribute(workerProto, 'message');
defineEventAttribute(workerProto, 'messageerror');
defineEventAttribute(workerProto, 'error');

Object.defineProperty(globalThis, 'Worker', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Worker
});
