import core from 'tjs:internal/core';

import { defineEventAttribute } from './event-target';

// The native MessagePort handle backing this port. Symbol-keyed so the internal
// factory / transfer helpers can reach it without exposing it to user code.
const kHandle = Symbol('kHandle');
const kStarted = Symbol('kStarted');
// Guards the constructor: ports are only minted internally (MessageChannel or on
// receipt of a transferred port), never via `new MessagePort()`.
const kCtor = Symbol('kCtor');

// A started port must stay alive while it is entangled and listening, even if
// user code keeps no reference to it (its only reference would otherwise be the
// weakly-held event listener). Pin started ports here and release on detach.
const startedPorts = new Set();

// Delivery kind passed to the native port's start() callback; mirrors
// mod_channel.c CHANNEL_DELIVER_*.
const DELIVER_MESSAGE_ERROR = 1;
const DELIVER_ERROR = 2;

function detachPort(port) {
    startedPorts.delete(port);
    port[kHandle] = null;
}

function normalizeTransfer(transferOrOptions) {
    if (Array.isArray(transferOrOptions)) {
        return transferOrOptions;
    }

    if (transferOrOptions && typeof transferOrOptions === 'object') {
        return transferOrOptions.transfer ?? [];
    }

    return [];
}

class MessagePort extends EventTarget {
    constructor(token) {
        if (token !== kCtor) {
            throw new TypeError('Illegal constructor');
        }

        super();

        this[kHandle] = null;
        this[kStarted] = false;
    }

    postMessage(message, transferOrOptions) {
        const handle = this[kHandle];

        if (!handle) {
            throw new DOMException('The port is detached', 'InvalidStateError');
        }

        postMessageWithTransfer(handle, message, transferOrOptions, this);
    }

    start() {
        if (this[kStarted]) {
            return;
        }

        const handle = this[kHandle];

        if (!handle) {
            return;
        }

        this[kStarted] = true;
        startedPorts.add(this);
        handle.start((data, ports, kind) => {
            if (kind === DELIVER_MESSAGE_ERROR) {
                this.dispatchEvent(new MessageEvent('messageerror', {}));

                return;
            }

            this.dispatchEvent(new MessageEvent('message', {
                data,
                ports: ports?.map(createPort)
            }));
        });
    }

    close() {
        const handle = this[kHandle];

        detachPort(this);

        if (handle) {
            handle.close();
        }
    }

    get [Symbol.toStringTag]() {
        return 'MessagePort';
    }
}

const messagePortProto = MessagePort.prototype;

defineEventAttribute(messagePortProto, 'message');
defineEventAttribute(messagePortProto, 'messageerror');

// Per the spec, setting the `onmessage` IDL attribute implicitly starts the port
// (unlike addEventListener('message'), which does not).
const onmessageDescriptor = Object.getOwnPropertyDescriptor(messagePortProto, 'onmessage');

Object.defineProperty(messagePortProto, 'onmessage', {
    configurable: true,
    enumerable: true,
    get: onmessageDescriptor.get,
    set(listener) {
        onmessageDescriptor.set.call(this, listener);
        this.start();
    }
});

function createPort(handle) {
    const port = new MessagePort(kCtor);

    port[kHandle] = handle;

    return port;
}

// Post `message` on a native port handle, transferring the ports and ArrayBuffers
// in the transfer list. Shared by MessagePort.postMessage and the Worker channel.
// `sourcePort` (if any) cannot appear in its own transfer list.
function postMessageWithTransfer(handle, message, transferOrOptions, sourcePort) {
    const transfer = normalizeTransfer(transferOrOptions);
    const portHandles = [];
    const buffers = [];
    const seen = new Set();

    for (const t of transfer) {
        if (t === sourcePort) {
            throw new DOMException('The source port cannot be transferred', 'DataCloneError');
        }

        if (seen.has(t)) {
            throw new DOMException('A transferable was listed more than once', 'DataCloneError');
        }

        seen.add(t);

        if (t instanceof MessagePort) {
            const h = t[kHandle];

            if (!h) {
                throw new DOMException('A transferred port is detached', 'DataCloneError');
            }

            portHandles.push(h);
        } else if (core.isArrayBuffer(t)) {
            buffers.push(t);
        } else {
            throw new DOMException('Value is not transferable', 'DataCloneError');
        }
    }

    // The native side serializes first, so a clone failure throws before
    // anything is transferred. On success the transferred ports' underlying
    // handles have been neutered, so neuter the JS wrappers too.
    handle.postMessage(message, portHandles, buffers);

    for (const t of transfer) {
        if (t instanceof MessagePort) {
            detachPort(t);
        }
    }
}

class MessageChannel {
    #port1;
    #port2;

    constructor() {
        const [ h1, h2 ] = core.channelNew();

        this.#port1 = createPort(h1);
        this.#port2 = createPort(h2);
    }

    get port1() {
        return this.#port1;
    }

    get port2() {
        return this.#port2;
    }

    get [Symbol.toStringTag]() {
        return 'MessageChannel';
    }
}

// Exposed on the internal core object so the worker bootstrap (a separate bundle)
// can wrap its side of the worker channel and post with transfers.
core.createPort = createPort;
core.postMessageWithTransfer = postMessageWithTransfer;

Object.defineProperty(globalThis, 'MessagePort', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: MessagePort
});

Object.defineProperty(globalThis, 'MessageChannel', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: MessageChannel
});

export { MessagePort, MessageChannel, createPort, postMessageWithTransfer, DELIVER_MESSAGE_ERROR, DELIVER_ERROR };
