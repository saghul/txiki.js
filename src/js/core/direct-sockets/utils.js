import core from 'tjs:internal/core';

export { core };

// Symbol-keyed hooks for subclasses in sibling files. Exported only from
// this module-internal utils.js (not from the package barrel), so external
// callers can't reach them.
export const kSetOpened = Symbol('setOpened');
export const kGetHandle = Symbol('getHandle');
export const kRejectClosed = Symbol('rejectClosed');

export function silentClose(handle) {
    try {
        handle.close();
    } catch {
        // Ignored.
    }
}


export class BaseStreamSocket {
    #handle;
    #opened;
    #closed;
    #closedResolve;
    #closedReject;
    #pendingWrite = null;
    #readableActive = true;
    #writableActive = true;
    #readableError = null;
    #writableError = null;

    constructor(handle) {
        this._init(handle);
    }

    _init(handle) {
        this.#handle = handle;
        this.#pendingWrite = null;
        this.#readableActive = true;
        this.#writableActive = true;
        this.#readableError = null;
        this.#writableError = null;

        handle.onwrite = error => {
            const pending = this.#pendingWrite;

            if (pending) {
                this.#pendingWrite = null;

                if (error) {
                    pending.reject(error);
                } else {
                    pending.resolve();
                }
            }
        };

        const { promise, resolve, reject } = Promise.withResolvers();

        this.#closed = promise;
        // Prevent unhandled rejection if the socket fails to open and
        // nobody observes the closed promise.
        promise.catch(() => {});
        this.#closedResolve = resolve;
        this.#closedReject = reject;
    }

    // Subclasses set their opened promise via this internal hook.
    [kSetOpened](promise) {
        this.#opened = promise;
    }

    [kGetHandle]() {
        return this.#handle;
    }

    [kRejectClosed](error) {
        this.#closedReject(error);
    }

    _doWrite(buf) {
        if (this.#handle.write(buf)) {
            return Promise.resolve();
        }

        const { promise, resolve, reject } = Promise.withResolvers();

        this.#pendingWrite = { resolve, reject };

        return promise;
    }

    _connect(addr) {
        const handle = this.#handle;
        const { promise, resolve, reject } = Promise.withResolvers();

        handle.onconnect = error => {
            handle.onconnect = null;

            if (error) {
                reject(error);
            } else {
                resolve();
            }
        };

        handle.connect(addr);

        return promise;
    }

    #handleClosingReadable(error) {
        if (!this.#readableActive) {
            return;
        }

        this.#readableActive = false;

        if (error) {
            this.#readableError = error;
        }

        this.#maybeClose();
    }

    #handleClosingWritable(error) {
        if (!this.#writableActive) {
            return;
        }

        this.#writableActive = false;

        if (error) {
            this.#writableError = error;
        }

        this.#maybeClose();
    }

    #maybeClose() {
        if (this.#readableActive || this.#writableActive) {
            return;
        }

        silentClose(this.#handle);

        const error = this.#writableError || this.#readableError;

        if (error) {
            this.#closedReject(error);
        } else {
            this.#closedResolve();
        }
    }

    _createReadableStream() {
        const handle = this.#handle;
        let reading = false;

        return new ReadableStream({
            start: controller => {
                handle.onread = (data, error) => {
                    if (error) {
                        handle.stopRead();
                        reading = false;
                        handle.onread = null;
                        controller.error(error);
                        this.#handleClosingReadable(error);
                    } else if (data === null) {
                        handle.stopRead();
                        reading = false;
                        handle.onread = null;
                        controller.close();
                        this.#handleClosingReadable();
                    } else {
                        controller.enqueue(data);

                        if (controller.desiredSize <= 0) {
                            handle.stopRead();
                            reading = false;
                        }
                    }
                };

                reading = true;
                handle.startRead();
            },
            pull() {
                if (!reading) {
                    reading = true;
                    handle.startRead();
                }
            },
            cancel: () => {
                if (reading) {
                    handle.stopRead();
                    reading = false;
                }

                handle.onread = null;
                this.#handleClosingReadable();
            }
        });
    }

    _createWritableStream() {
        return new WritableStream({
            write: chunk => this._doWrite(chunk),
            close: () => {
                try {
                    this.#handle.shutdown();
                } catch {
                    // Handle may already be closed.
                }

                this.#handleClosingWritable();
            },
            abort: reason => {
                try {
                    this.#handle.shutdown();
                } catch {
                    // Handle may already be closed.
                }

                this.#handleClosingWritable(reason);
            }
        });
    }

    _buildOpenedInfo() {
        return {
            readable: this._createReadableStream(),
            writable: this._createWritableStream(),
        };
    }

    get opened() {
        return this.#opened;
    }

    get closed() {
        return this.#closed;
    }

    close() {
        this.#readableActive = false;
        this.#writableActive = false;
        silentClose(this.#handle);
        this.#closedResolve();
    }
}


export class BaseStreamServerSocket {
    #handle;
    #opened;
    #closed;
    #closedResolve;
    #closedReject;

    constructor(handle) {
        this.#handle = handle;

        const { promise, resolve, reject } = Promise.withResolvers();

        this.#closed = promise;
        // Prevent unhandled rejection if the server fails to bind and
        // nobody observes the closed promise.
        promise.catch(() => {});
        this.#closedResolve = resolve;
        this.#closedReject = reject;
    }

    [kSetOpened](promise) {
        this.#opened = promise;
    }

    [kGetHandle]() {
        return this.#handle;
    }

    [kRejectClosed](error) {
        this.#closedReject(error);
    }

    _createAcceptStream(createSocket) {
        const handle = this.#handle;

        return new ReadableStream({
            start(controller) {
                handle.onconnection = (error, clientHandle) => {
                    if (typeof error === 'undefined' && typeof clientHandle === 'undefined') {
                        // Server handle closed.
                        controller.close();

                        return;
                    }

                    if (error) {
                        controller.error(error);
                    } else {
                        controller.enqueue(createSocket(clientHandle));
                    }
                };
            },
            cancel: () => {
                this.close();
            }
        });
    }

    _createAcceptedSocket(SocketClass, clientHandle, formatAddress) {
        // Construct using BaseStreamSocket's constructor so the private fields
        // are properly installed, while ending up as an instance of SocketClass.
        const socket = Reflect.construct(BaseStreamSocket, [ clientHandle ], SocketClass);

        const localAddr = clientHandle.getsockname();
        const remoteAddr = clientHandle.getpeername();

        socket[kSetOpened](Promise.resolve({
            ...socket._buildOpenedInfo(),
            ...formatAddress(localAddr, remoteAddr),
        }));

        return socket;
    }

    get opened() {
        return this.#opened;
    }

    get closed() {
        return this.#closed;
    }

    close() {
        silentClose(this.#handle);
        this.#closedResolve();
    }
}
