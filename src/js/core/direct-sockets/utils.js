const core = globalThis[Symbol.for('tjs.internal.core')];

export { core };

// Shared symbols.
export const kHandle = Symbol('kHandle');
export const kOpened = Symbol('kOpened');
export const kClosed = Symbol('kClosed');

// Module-local symbol (only used within BaseStreamSocket).
const kPendingWrite = Symbol('kPendingWrite');

export function silentClose(handle) {
    try {
        handle.close();
    } catch {
        // Ignored.
    }
}


export class BaseStreamSocket {
    constructor(handle) {
        this._init(handle);
    }

    _init(handle) {
        this[kHandle] = handle;
        this[kPendingWrite] = null;
        this._readableActive = true;
        this._writableActive = true;
        this._readableError = null;
        this._writableError = null;

        handle.onwrite = error => {
            const pending = this[kPendingWrite];

            if (pending) {
                this[kPendingWrite] = null;

                if (error) {
                    pending.reject(error);
                } else {
                    pending.resolve();
                }
            }
        };

        const { promise, resolve, reject } = Promise.withResolvers();

        this[kClosed] = promise;
        this._closedResolve = resolve;
        this._closedReject = reject;
    }

    _doWrite(buf) {
        const result = this[kHandle].write(buf);

        if (typeof result === 'number') {
            return Promise.resolve(result);
        }

        const { promise, resolve, reject } = Promise.withResolvers();

        this[kPendingWrite] = { resolve, reject };

        return promise;
    }

    _connect(addr) {
        const handle = this[kHandle];
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

    _handleClosingReadable(error) {
        if (!this._readableActive) {
            return;
        }

        this._readableActive = false;

        if (error) {
            this._readableError = error;
        }

        this._maybeClose();
    }

    _handleClosingWritable(error) {
        if (!this._writableActive) {
            return;
        }

        this._writableActive = false;

        if (error) {
            this._writableError = error;
        }

        this._maybeClose();
    }

    _maybeClose() {
        if (this._readableActive || this._writableActive) {
            return;
        }

        silentClose(this[kHandle]);

        const error = this._writableError || this._readableError;

        if (error) {
            this._closedReject(error);
        } else {
            this._closedResolve();
        }
    }

    _createReadableStream() {
        const handle = this[kHandle];
        let reading = false;

        return new ReadableStream({
            start: controller => {
                handle.onread = (data, error) => {
                    if (error) {
                        handle.stopRead();
                        reading = false;
                        handle.onread = null;
                        controller.error(error);
                        this._handleClosingReadable(error);
                    } else if (data === null) {
                        handle.stopRead();
                        reading = false;
                        handle.onread = null;
                        controller.close();
                        this._handleClosingReadable();
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
                this._handleClosingReadable();
            }
        });
    }

    _createWritableStream() {
        return new WritableStream({
            write: chunk => this._doWrite(chunk),
            close: () => {
                try {
                    this[kHandle].shutdown();
                } catch {
                    // Handle may already be closed.
                }

                this._handleClosingWritable();
            },
            abort: reason => {
                try {
                    this[kHandle].shutdown();
                } catch {
                    // Handle may already be closed.
                }

                this._handleClosingWritable(reason);
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
        return this[kOpened];
    }

    get closed() {
        return this[kClosed];
    }

    close() {
        this._readableActive = false;
        this._writableActive = false;
        silentClose(this[kHandle]);
        this._closedResolve();
    }
}


export class BaseStreamServerSocket {
    constructor(handle) {
        this[kHandle] = handle;

        const { promise, resolve, reject } = Promise.withResolvers();

        this[kClosed] = promise;
        this._closedResolve = resolve;
        this._closedReject = reject;
    }

    _createAcceptStream(createSocket) {
        const handle = this[kHandle];

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

    _createAcceptedSocket(proto, clientHandle, formatAddress) {
        const socket = Object.create(proto);

        BaseStreamSocket.prototype._init.call(socket, clientHandle);

        const localAddr = clientHandle.getsockname();
        const remoteAddr = clientHandle.getpeername();

        socket[kOpened] = Promise.resolve({
            ...socket._buildOpenedInfo(),
            ...formatAddress(localAddr, remoteAddr),
        });

        return socket;
    }

    get opened() {
        return this[kOpened];
    }

    get closed() {
        return this[kClosed];
    }

    close() {
        silentClose(this[kHandle]);
        this._closedResolve();
    }
}
