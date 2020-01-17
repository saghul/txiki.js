// 2nd bootstrap. Here all modules that need to pollute the global namespace are
// already loaded.
//

import { AbortController, AbortSignal } from '@tjs/abort-controller';
import { Console } from '@tjs/console';
import { XMLHttpRequest as XHR, Worker as _Worker } from '@tjs/core';
import { defineEventAttribute, EventTarget, Event, CustomEvent } from '@tjs/event-target';
import { Performance } from '@tjs/performance';


// Console
//

Object.defineProperty(window, 'console', {
    enumerable: true,
    configurable: true,
    writable: true,
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
    CustomEvent: {
        enumerable: true,
        configurable: true,
        writable: true,
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
    configurable: true,
    writable: true,
    value: new Performance()
});


// AbortController
//

Object.defineProperty(window, 'AbortController', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: AbortController
});

Object.defineProperty(window, 'AbortSignal', {
    enumerable: true,
    configurable: true,
    writable: true,
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
    configurable: true,
    writable: true,
    value: Worker
});


// XMLHttpRequest
//

const kXHR = Symbol('kXHR');

class XMLHttpRequest extends EventTarget {
    static UNSENT = XHR.UNSENT;
    static OPENED = XHR.OPENED;
    static HEADERS_RECEIVED = XHR.HEADERS_RECEIVED;
    static LOADING = XHR.LOADING;
    static DONE = XHR.DONE;
    UNSENT = XHR.UNSENT;
    OPENED = XHR.OPENED;
    HEADERS_RECEIVED = XHR.HEADERS_RECEIVED;
    LOADING = XHR.LOADING;
    DONE = XHR.DONE;

    constructor() {
        super();

        const xhr = new XHR();
        xhr.onabort = () => {
            this.dispatchEvent(new Event('abort'));
        };
        xhr.onerror = () => {
            this.dispatchEvent(new Event('error'));
        };
        xhr.onload = () => {
            this.dispatchEvent(new Event('load'));
        };
        xhr.onloadend = () => {
            this.dispatchEvent(new Event('loadend'));
        };
        xhr.onloadstart = () => {
            this.dispatchEvent(new Event('loadstart'));
        };
        xhr.onprogress = p => {
            this.dispatchEvent(new Event('progress', p));
        };
        xhr.onreadystatechange = () => {
            this.dispatchEvent(new Event('readystatechange'));
        };
        xhr.ontimeout = () => {
            this.dispatchEvent(new Event('timeout'));
        };

        this[kXHR] = xhr;
    }

    get readyState() {
        return this[kXHR].readyState;
    }

    get response() {
        return this[kXHR].response;
    }

    get responseText() {
        return this[kXHR].responseText;
    }

    set responseType(value) {
        this[kXHR].responseType = value;
    }

    get responseType() {
        return this[kXHR].responseType;
    }

    get responseURL() {
        return this[kXHR].responseURL;
    }

    get status() {
        return this[kXHR].status;
    }

    get statusText() {
        return this[kXHR].statusText;
    }

    set timeout(value) {
        this[kXHR].timeout = value;
    }

    get timeout() {
        return this[kXHR].timeout;
    }

    get upload() {
        return this[kXHR].upload;
    }

    set withCcredentials(value) {
        this[kXHR].withCcredentials = value;
    }

    get withCcredentials() {
        return this[kXHR].withCcredentials;
    }

    abort() {
        return this[kXHR].abort();
    }

    getAllResponseHeaders() {
        return this[kXHR].getAllResponseHeaders();
    }

    getResponseHeader(name) {
        return this[kXHR].getResponseHeader(name);
    }

    open(...args) {
        return this[kXHR].open(...args);
    }

    overrideMimeType(mimeType) {
        return this[kXHR].overrideMimeType(mimeType);
    }

    send(body) {
        return this[kXHR].send(body);
    }

    setRequestHeader(name, value) {
        return this[kXHR].setRequestHeader(name, value);
    }
}

const xhrProto = XMLHttpRequest.prototype;
defineEventAttribute(xhrProto, 'abort');
defineEventAttribute(xhrProto, 'error');
defineEventAttribute(xhrProto, 'load');
defineEventAttribute(xhrProto, 'loadend');
defineEventAttribute(xhrProto, 'loadstart');
defineEventAttribute(xhrProto, 'progress');
defineEventAttribute(xhrProto, 'readystatechange');
defineEventAttribute(xhrProto, 'timeout');

Object.defineProperty(window, 'XMLHttpRequest', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: XMLHttpRequest
});
