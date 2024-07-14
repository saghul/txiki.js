(function () {
    const messagePipe = globalThis[Symbol.for('tjs.internal.worker.messagePipe')];

    messagePipe.onmessage = msg => {
        self.dispatchEvent(new MessageEvent('message', msg));
    };

    messagePipe.onmessageerror = msgerror => {
        self.dispatchEvent(new MessageEvent('messageerror', msgerror));
    };

    self.postMessage = message => messagePipe.postMessage(message);

    const defineEventAttribute = EventTarget.__defineEventAttribute;

    defineEventAttribute(Object.getPrototypeOf(self), 'message');
    defineEventAttribute(Object.getPrototypeOf(self), 'messageerror');
    defineEventAttribute(Object.getPrototypeOf(self), 'error');
})();
