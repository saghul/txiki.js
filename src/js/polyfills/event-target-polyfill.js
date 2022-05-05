import { defineEventAttribute, EventTarget, Event, CustomEvent } from './event-target.js';

const kErrorEventData = Symbol('kErrorEventData');

class ErrorEvent extends Event {
    constructor(error) {
        super('error');

        this[kErrorEventData] = error;
    }

    get message() {
        return String(this[kErrorEventData]);
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
        return this[kErrorEventData];
    }
}

const kMessageEventData = Symbol('kMessageEventData');

class MessageEvent extends Event {
    constructor(eventTye, data) {
        super(eventTye);

        this[kMessageEventData] = data;
    }

    get data() {
        return this[kMessageEventData];
    }
}

const kPromise = Symbol('kPromise');
const kPromiseRejectionReason = Symbol('kPromiseRejectionReason');

class PromiseRejectionEvent extends Event {
    constructor(eventTye, promise, reason) {
        super(eventTye, { cancelable: true });

        this[kPromise] = promise;
        this[kPromiseRejectionReason] = reason;
    }

    get promise() {
        return this[kPromise];
    }

    get reason() {
        return this[kPromiseRejectionReason];
    }
}

const kProgressEventLengthComputable = Symbol('kProgressEventLengthComputable');
const kProgressEventLoaded = Symbol('kProgressEventLoaded');
const kProgressEventTotal = Symbol('kProgressEventTotal');

class ProgressEvent extends Event {
    constructor(eventTye, init) {
        super(eventTye, init);

        this[kProgressEventLengthComputable] = init?.lengthComputable || false;
        this[kProgressEventLoaded] = init?.loaded || 0;
        this[kProgressEventTotal] = init?.total || 0;
    }

    get lengthComputable() {
        return this[kProgressEventLengthComputable];
    }

    get loaded() {
        return this[kProgressEventLoaded];
    }

    get total() {
        return this[kProgressEventTotal];
    }
}

Object.defineProperties(window, {
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
defineEventAttribute(windowProto, 'unhandledrejection');

// Export it for worker-bootstrap.
EventTarget.__defineEventAttribute = defineEventAttribute;
