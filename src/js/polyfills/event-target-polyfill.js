import core from 'tjs:internal/core';

import { defineEventAttribute, EventTarget, Event, CustomEvent } from './event-target.js';

class CloseEvent extends Event {
    #code;
    #reason;
    #wasClean;

    constructor(eventTye, init) {
        super(eventTye, init);

        this.#code = init?.code ?? 0;
        this.#reason = init?.reason ?? '';
        this.#wasClean = init?.wasClean ?? false;
    }

    get code() {
        return this.#code;
    }

    get reason() {
        return this.#reason;
    }

    get wasClean() {
        return this.#wasClean;
    }
}

class ErrorEvent extends Event {
    #message;
    #filename;
    #lineno;
    #colno;
    #error;

    constructor(type, init = {}) {
        super(type, init);

        this.#message = init.message ?? '';
        this.#filename = init.filename ?? '';
        this.#lineno = init.lineno ?? 0;
        this.#colno = init.colno ?? 0;
        this.#error = init.error;
    }

    get message() {
        return this.#message;
    }

    get filename() {
        return this.#filename;
    }

    get lineno() {
        return this.#lineno;
    }

    get colno() {
        return this.#colno;
    }

    get error() {
        return this.#error;
    }
}

class MessageEvent extends Event {
    #data;

    constructor(eventTye, data) {
        super(eventTye);

        this.#data = data;
    }

    get data() {
        return this.#data;
    }
}

class PromiseRejectionEvent extends Event {
    #promise;
    #reason;

    constructor(eventTye, promise, reason) {
        super(eventTye, { cancelable: true });

        this.#promise = promise;
        this.#reason = reason;
    }

    get promise() {
        return this.#promise;
    }

    get reason() {
        return this.#reason;
    }
}

class ProgressEvent extends Event {
    #lengthComputable;
    #loaded;
    #total;

    constructor(eventTye, init) {
        super(eventTye, init);

        this.#lengthComputable = init?.lengthComputable || false;
        this.#loaded = init?.loaded || 0;
        this.#total = init?.total || 0;
    }

    get lengthComputable() {
        return this.#lengthComputable;
    }

    get loaded() {
        return this.#loaded;
    }

    get total() {
        return this.#total;
    }
}

Object.defineProperties(globalThis, {
    CloseEvent: {
        enumerable: true,
        configurable: true,
        writable: true,
        value: CloseEvent
    },
    EventTarget: {
        enumerable: true,
        configurable: true,
        writable: true,
        value: EventTarget
    },
    Event: {
        enumerable: true,
        configurable: true,
        writable: true,
        value: Event
    },
    ErrorEvent: {
        enumerable: true,
        configurable: true,
        writable: true,
        value: ErrorEvent
    },
    MessageEvent: {
        enumerable: true,
        configurable: true,
        writable: true,
        value: MessageEvent
    },
    PromiseRejectionEvent: {
        enumerable: true,
        configurable: true,
        writable: true,
        value: PromiseRejectionEvent
    },
    ProgressEvent: {
        enumerable: true,
        configurable: true,
        writable: true,
        value: ProgressEvent
    },
    CustomEvent: {
        enumerable: true,
        configurable: true,
        writable: true,
        value: CustomEvent
    }
});

Object.setPrototypeOf(globalThis, EventTarget.prototype);
EventTarget.prototype.__init.call(globalThis);

const globalProto = Object.getPrototypeOf(globalThis);

defineEventAttribute(globalProto, 'load');
defineEventAttribute(globalProto, 'beforeunload');
defineEventAttribute(globalProto, 'unhandledrejection');

// Stash on the internal core object so the worker bootstrap (which has no
// other way to reach this module) can pick it up without exposing it to
// user code via the global EventTarget.
core.defineEventAttribute = defineEventAttribute;
