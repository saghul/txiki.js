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
    #error;

    constructor(error) {
        super('error');

        this.#error = error;
    }

    get message() {
        return String(this.#error);
    }

    get filename() {
        return undefined;
    }

    get lineno() {
        return undefined;
    }

    get colno() {
        return undefined;
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

Object.defineProperties(window, {
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

Object.setPrototypeOf(window, EventTarget.prototype);
EventTarget.prototype.__init.call(window);

const windowProto = Object.getPrototypeOf(window);

defineEventAttribute(windowProto, 'load');
defineEventAttribute(windowProto, 'beforeunload');
defineEventAttribute(windowProto, 'unhandledrejection');

// Export it for worker-bootstrap.
EventTarget.__defineEventAttribute = defineEventAttribute;
