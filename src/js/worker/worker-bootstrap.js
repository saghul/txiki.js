import core from 'tjs:internal/core';
import messagePipe from 'tjs:internal/worker';

messagePipe.onmessage = msg => {
    self.dispatchEvent(new MessageEvent('message', msg));
};

messagePipe.onmessageerror = msgerror => {
    self.dispatchEvent(new MessageEvent('messageerror', msgerror));
};

self.postMessage = message => messagePipe.postMessage(message);

core.defineEventAttribute(Object.getPrototypeOf(self), 'message');
core.defineEventAttribute(Object.getPrototypeOf(self), 'messageerror');
core.defineEventAttribute(Object.getPrototypeOf(self), 'error');
