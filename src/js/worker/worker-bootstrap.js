(function () {
    const worker = globalThis[Symbol.for('tjs.internal.worker')];

    worker.onmessage = msg => {
        self.dispatchEvent(new MessageEvent('message', msg));
    };

    worker.onmessageerror = msgerror => {
        self.dispatchEvent(new MessageEvent('messageerror', msgerror));
    };

    worker.onerror = error => {
        self.dispatchEvent(new ErrorEvent(error));
    };

    self.postMessage = message => worker.postMessage(message);

    const defineEventAttribute = EventTarget.__defineEventAttribute;

    defineEventAttribute(Object.getPrototypeOf(self), 'message');
    defineEventAttribute(Object.getPrototypeOf(self), 'messageerror');
    defineEventAttribute(Object.getPrototypeOf(self), 'error');
})();
