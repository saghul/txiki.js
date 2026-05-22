import { defineEventAttribute, EventTarget, Event } from './event-target.js';

function defaultAbortReason() {
    return new DOMException('This operation was aborted', 'AbortError');
}

// Module-private invoker, captured from inside the class so it can reach the
// `#signalAbort` private method without exposing it.
let signalAbort;

class AbortSignal extends EventTarget {
    #aborted = false;
    #reason;

    get aborted() {
        return this.#aborted;
    }

    get reason() {
        return this.#reason;
    }

    throwIfAborted() {
        if (this.#aborted) {
            throw this.#reason;
        }
    }

    // Flip to aborted state. Returns true if the signal transitioned, false
    // if it was already aborted. Reachable only via `signalAbort()` below.
    #signalAbort(reason, dispatch = true) {
        if (this.#aborted) {
            return false;
        }

        this.#aborted = true;
        this.#reason = reason !== undefined ? reason : defaultAbortReason();

        if (dispatch) {
            this.dispatchEvent(new Event('abort'));
        }

        return true;
    }

    static {
        signalAbort = (signal, reason, dispatch) => signal.#signalAbort(reason, dispatch);
    }

    static abort(reason) {
        const signal = new AbortSignal();

        signal.#signalAbort(reason, false);

        return signal;
    }

    static timeout(ms) {
        const signal = new AbortSignal();

        setTimeout(() => {
            signal.#signalAbort(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
        }, ms);

        return signal;
    }

    static any(signals) {
        const signal = new AbortSignal();

        for (const s of signals) {
            if (s.aborted) {
                signal.#signalAbort(s.reason, false);

                return signal;
            }
        }

        const onAbort = () => {
            for (const s of signals) {
                if (s.aborted) {
                    if (signal.#signalAbort(s.reason)) {
                        // Clean up all listeners.
                        for (const s2 of signals) {
                            s2.removeEventListener('abort', onAbort);
                        }
                    }

                    break;
                }
            }
        };

        for (const s of signals) {
            s.addEventListener('abort', onAbort);
        }

        return signal;
    }
}

defineEventAttribute(AbortSignal.prototype, 'abort');

AbortSignal.prototype[Symbol.toStringTag] = 'AbortSignal';

class AbortController {
    constructor() {
        this.signal = new AbortSignal();
    }

    abort(reason) {
        signalAbort(this.signal, reason);
    }
}

AbortController.prototype[Symbol.toStringTag] = 'AbortController';

Object.defineProperties(globalThis, {
    AbortController: {
        enumerable: true,
        configurable: true,
        writable: true,
        value: AbortController
    },
    AbortSignal: {
        enumerable: true,
        configurable: true,
        writable: true,
        value: AbortSignal
    }
});
