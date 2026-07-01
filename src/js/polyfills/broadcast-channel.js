import core from 'tjs:internal/core';

import { defineEventAttribute } from './event-target';

// An open BroadcastChannel keeps receiving until closed, even if user code holds
// no reference to it (its only reference would otherwise be the weakly-held event
// listener). Pin open channels here and release on close().
const openChannels = new Set();

class BroadcastChannel extends EventTarget {
    #handle;
    #name;
    #closed;

    constructor(name) {
        super();

        if (arguments.length < 1) {
            throw new TypeError('Failed to construct \'BroadcastChannel\': 1 argument required');
        }

        const channelName = String(name);

        this.#name = channelName;
        this.#closed = false;
        this.#handle = core.broadcastNew(channelName, (data, isError) => {
            if (isError) {
                this.dispatchEvent(new MessageEvent('messageerror', {}));

                return;
            }

            this.dispatchEvent(new MessageEvent('message', { data }));
        });

        openChannels.add(this);
    }

    get name() {
        return this.#name;
    }

    postMessage(message) {
        if (this.#closed) {
            throw new DOMException('The BroadcastChannel is closed', 'InvalidStateError');
        }

        this.#handle.postMessage(message);
    }

    close() {
        if (this.#closed) {
            return;
        }

        this.#closed = true;
        openChannels.delete(this);
        this.#handle.close();
    }

    get [Symbol.toStringTag]() {
        return 'BroadcastChannel';
    }
}

const broadcastChannelProto = BroadcastChannel.prototype;

defineEventAttribute(broadcastChannelProto, 'message');
defineEventAttribute(broadcastChannelProto, 'messageerror');

Object.defineProperty(globalThis, 'BroadcastChannel', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: BroadcastChannel
});
