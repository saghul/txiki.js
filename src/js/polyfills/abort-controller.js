import { defineEventAttribute, EventTarget, Event } from './event-target.js';

const kAborted = Symbol('kAborted');
const kReason = Symbol('kReason');

function defaultAbortReason() {
    return new DOMException('This operation was aborted', 'AbortError');
}

class AbortSignal extends EventTarget {
    constructor() {
        super();
        this[kAborted] = false;
        this[kReason] = undefined;
    }

    get aborted() {
        return this[kAborted];
    }

    get reason() {
        return this[kReason];
    }

    throwIfAborted() {
        if (this[kAborted]) {
            throw this[kReason];
        }
    }

    static abort(reason) {
        const signal = new AbortSignal();

        signal[kAborted] = true;
        signal[kReason] = reason !== undefined ? reason : defaultAbortReason();

        return signal;
    }

    static timeout(ms) {
        const signal = new AbortSignal();

        setTimeout(() => {
            if (!signal[kAborted]) {
                signal[kAborted] = true;
                signal[kReason] = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
                signal.dispatchEvent(new Event('abort'));
            }
        }, ms);

        return signal;
    }

    static any(signals) {
        const signal = new AbortSignal();

        for (const s of signals) {
            if (s[kAborted]) {
                signal[kAborted] = true;
                signal[kReason] = s[kReason];

                return signal;
            }
        }

        const onAbort = () => {
            if (signal[kAborted]) {
                return;
            }

            for (const s of signals) {
                if (s[kAborted]) {
                    signal[kAborted] = true;
                    signal[kReason] = s[kReason];
                    signal.dispatchEvent(new Event('abort'));

                    // Clean up all listeners.
                    for (const s2 of signals) {
                        s2.removeEventListener('abort', onAbort);
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
        const signal = this.signal;

        if (signal[kAborted]) {
            return;
        }

        signal[kAborted] = true;
        signal[kReason] = reason !== undefined ? reason : defaultAbortReason();
        signal.dispatchEvent(new Event('abort'));
    }
}

AbortController.prototype[Symbol.toStringTag] = 'AbortController';

Object.defineProperties(window, {
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
