import core from 'tjs:internal/core';
import messagePipe from 'tjs:internal/worker';

// mod_channel.c CHANNEL_DELIVER_MESSAGE_ERROR (a payload that failed to clone).
const DELIVER_MESSAGE_ERROR = 1;

self.postMessage = (message, transferOrOptions) => {
    core.postMessageWithTransfer(messagePipe, message, transferOrOptions, null);
};

self.close = () => core.workerClose();

core.defineEventAttribute(Object.getPrototypeOf(self), 'message');
core.defineEventAttribute(Object.getPrototypeOf(self), 'messageerror');
core.defineEventAttribute(Object.getPrototypeOf(self), 'error');

// Enabling inbound delivery is deferred until the worker's entry module has run
// (worker.c calls this after evaluating it), so a message the parent posts during
// startup is buffered and then delivered rather than dispatched to the still
// listener-less global and dropped. Mirrors the HTML spec enabling a worker's port
// message queue only after the worker script has run.
core.workerStartMessagePipe = () => {
    messagePipe.start((data, ports, kind) => {
        if (kind === DELIVER_MESSAGE_ERROR) {
            self.dispatchEvent(new MessageEvent('messageerror', {}));

            return;
        }

        self.dispatchEvent(new MessageEvent('message', { data, ports: ports?.map(core.createPort) }));
    });
};
