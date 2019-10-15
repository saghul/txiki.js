// 2nd bootstrap. Here all modules that need to pollute the global namespace are
// already loaded.
//

import { AbortController, AbortSignal } from '@tjs/abort-controller';
import { Console } from '@tjs/console';
import { Worker as _Worker } from '@tjs/core';
import { defineEventAttribute, EventTarget, Event, CustomEvent } from '@tjs/event-target';
import { Performance } from '@tjs/performance';


// Console
//

Object.defineProperty(window, 'console', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: new Console()
});


// EventTarget
//

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

Object.defineProperties(window, {
    EventTarget: {
        enumerable: true,
        configurable: false,
        writable: false,
        value: EventTarget
    },
    Event: {
        enumerable: true,
        configurable: false,
        writable: false,
        value: Event
    },
    ErrorEvent: {
        enumerable: true,
        configurable: false,
        writable: false,
        value: ErrorEvent
    },
    MessageEvent: {
        enumerable: true,
        configurable: false,
        writable: false,
        value: MessageEvent
    },
    CustomEvent: {
        enumerable: true,
        configurable: false,
        writable: false,
        value: CustomEvent
    }
});

Object.setPrototypeOf(window, EventTarget.prototype);
EventTarget.prototype.__init.call(window);

defineEventAttribute(Object.getPrototypeOf(window), 'load');


// Performance
//

Object.defineProperty(window, 'performance', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: new Performance()
});


// AbortController
//

Object.defineProperty(window, 'AbortController', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: AbortController
});

Object.defineProperty(window, 'AbortSignal', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: AbortSignal
});


// Worker
//

const kWorker = Symbol('kWorker');

class Worker extends EventTarget {
    constructor(path) {
        super();

        const worker = new _Worker(path);
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

    postMessage(...args) {
        this[kWorker].postMessage(args); 
    }

    terminate() {
        this[kWorker].terminate();
    }
}

defineEventAttribute(Object.getPrototypeOf(Worker), 'message');
defineEventAttribute(Object.getPrototypeOf(Worker), 'messageerror');
defineEventAttribute(Object.getPrototypeOf(Worker), 'error');

Object.defineProperty(window, 'Worker', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: Worker
});
