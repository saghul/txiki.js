import { isIP, lookup } from './lookup.js';

const core = globalThis[Symbol.for('tjs.internal.core')];


function silentClose(handle) {
    try {
        handle.close();
    } catch {
        // Ignored.
    }
}

function initWriteQueue(handle) {
    const queue = [];

    handle.onwrite = error => {
        const entry = queue.shift();

        if (entry) {
            if (error) {
                entry.reject(error);
            } else {
                entry.resolve();
            }
        }
    };

    return queue;
}

function writeWithQueue(handle, queue, buf) {
    const result = handle.write(buf);

    if (typeof result === 'number') {
        return Promise.resolve(result);
    }

    const { promise, resolve, reject } = Promise.withResolvers();

    queue.push({ resolve, reject });

    return promise;
}

function readableStreamForHandle(handle) {
    let reading = false;

    return new ReadableStream({
        start(controller) {
            handle.onread = (data, error) => {
                if (error) {
                    handle.stopRead();
                    reading = false;
                    handle.onread = null;
                    controller.error(error);
                } else if (data === null) {
                    handle.stopRead();
                    reading = false;
                    handle.onread = null;
                    controller.close();
                    silentClose(handle);
                } else {
                    controller.enqueue(data);

                    if (controller.desiredSize <= 0) {
                        handle.stopRead();
                        reading = false;
                    }
                }
            };
        },
        pull() {
            if (!reading) {
                reading = true;
                handle.startRead();
            }
        },
        cancel() {
            if (reading) {
                handle.stopRead();
                reading = false;
            }

            handle.onread = null;
            silentClose(handle);
        }
    });
}

function writableStreamForHandle(handle, writeFn) {
    return new WritableStream({
        async write(chunk, controller) {
            try {
                await writeFn(chunk);
            } catch (e) {
                controller.error(e);
            }
        },
        close() {
            silentClose(handle);
        },
        abort() {
            silentClose(handle);
        }
    });
}


function connectStream(handle, addr) {
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

export async function connect(transport, host, port, options = {}) {
    const addr = await resolveAddress(transport, host, port);

    switch (transport) {
        case 'tcp': {
            const handle = new core.TCP();

            if (options.bindAddr) {
                let flags = 0;

                if (options.ipv6Only) {
                    flags |= core.TCP_IPV6ONLY;
                }

                handle.bind(options.bindAddr, flags);
            }

            await connectStream(handle, addr);

            return new Connection(handle);
        }

        case 'pipe': {
            const handle = new core.Pipe();

            await connectStream(handle, addr);

            return new Connection(handle);
        }

        case 'udp': {
            const handle = new core.UDP();

            if (options.bindAddr) {
                let flags = 0;

                if (options.ipv6Only) {
                    flags |= core.UDP_IPV6ONLY;
                }

                handle.bind(options.bindAddr, flags);
            }

            handle.connect(addr);

            return new DatagramEndpoint(handle);
        }
    }
}

export async function listen(transport, host, port, options = {}) {
    const addr = await resolveAddress(transport, host, port);

    switch (transport) {
        case 'tcp': {
            const handle = new core.TCP();
            let flags = 0;

            if (options.ipv6Only) {
                flags |= core.TCP_IPV6ONLY;
            }

            handle.bind(addr, flags);
            handle.listen(options.backlog);

            return new Listener(handle);
        }

        case 'pipe': {
            const handle = new core.Pipe();

            handle.bind(addr);
            handle.listen(options.backlog);

            return new Listener(handle);
        }

        case 'udp': {
            const handle = new core.UDP();
            let flags = 0;

            if (options.reuseAddr) {
                flags |= core.UDP_REUSEADDR;
            }

            if (options.ipv6Only) {
                flags |= core.UDP_IPV6ONLY;
            }

            handle.bind(addr, flags);

            return new DatagramEndpoint(handle);
        }
    }
}

async function resolveAddress(transport, host, port) {
    switch (transport) {
        case 'tcp':

        // eslint-disable-next-line no-fallthrough
        case 'udp': {
            const h = host ?? '0.0.0.0';

            if (isIP(h)) {
                return {
                    ip: h,
                    port
                };
            }

            const r = await lookup(h);

            return {
                ...r,
                port
            };
        }

        case 'pipe':
            return host;

        default:
            throw new Error('invalid transport');
    }
}

const kHandle = Symbol('kHandle');
const kLocalAddress = Symbol('kLocalAddress');
const kRemoteAddress = Symbol('kRemoteAddress');
const kReadable = Symbol('kReadable');
const kWritable = Symbol('kWritable');
const kAcceptQueue = Symbol('kAcceptQueue');
const kPendingAccepts = Symbol('kPendingAccepts');
const kWriteQueue = Symbol('kWriteQueue');
const kSendQueue = Symbol('kSendQueue');

class Connection {
    constructor(handle) {
        this[kHandle] = handle;
        this[kWriteQueue] = initWriteQueue(handle);
    }

    get localAddress() {
        if (!this[kLocalAddress]) {
            this[kLocalAddress] = this[kHandle].getsockname();
        }

        return this[kLocalAddress];
    }

    get remoteAddress() {
        if (!this[kRemoteAddress]) {
            this[kRemoteAddress] = this[kHandle].getpeername();
        }

        return this[kRemoteAddress];
    }

    get readable() {
        if (!this[kReadable]) {
            this[kReadable] = readableStreamForHandle(this[kHandle]);
        }

        return this[kReadable];
    }

    get writable() {
        if (!this[kWritable]) {
            const handle = this[kHandle];
            const queue = this[kWriteQueue];

            this[kWritable] = writableStreamForHandle(handle, buf => writeWithQueue(handle, queue, buf));
        }

        return this[kWritable];
    }

    setKeepAlive(enable, delay) {
        this[kHandle].setKeepAlive(enable, delay);
    }

    setNoDelay(enable = true) {
        this[kHandle].setNoDelay(enable);
    }

    shutdown() {
        this[kHandle].shutdown();
    }

    close() {
        this[kHandle].close();
    }
}

class Listener {
    constructor(handle) {
        this[kHandle] = handle;
        this[kAcceptQueue] = [];
        this[kPendingAccepts] = [];

        handle.onconnection = (error, clientHandle) => {
            if (typeof error === 'undefined' && typeof clientHandle === 'undefined') {
                // Handle closed
                const pending = this[kPendingAccepts];

                this[kPendingAccepts] = [];

                for (const { resolve } of pending) {
                    resolve(undefined);
                }

                return;
            }

            if (this[kPendingAccepts].length > 0) {
                const { resolve, reject } = this[kPendingAccepts].shift();

                if (error) {
                    reject(error);
                } else {
                    resolve(new Connection(clientHandle));
                }
            } else {
                this[kAcceptQueue].push({ error, handle: clientHandle });
            }
        };
    }

    get localAddress() {
        if (!this[kLocalAddress]) {
            this[kLocalAddress] = this[kHandle].getsockname();
        }

        return this[kLocalAddress];
    }

    async accept() {
        if (this[kAcceptQueue].length > 0) {
            const { error, handle } = this[kAcceptQueue].shift();

            if (error) {
                throw error;
            }

            if (typeof handle === 'undefined') {
                return;
            }

            return new Connection(handle);
        }

        const { promise, resolve, reject } = Promise.withResolvers();

        this[kPendingAccepts].push({ resolve, reject });

        return await promise;
    }

    close() {
        this[kHandle].close();
    }

    // Async iterator.
    //

    [Symbol.asyncIterator]() {
        return this;
    }

    async next() {
        const value = await this.accept();

        return {
            value,
            done: typeof value === 'undefined'
        };
    }
}

class DatagramEndpoint {
    constructor(handle) {
        this[kHandle] = handle;
        this[kSendQueue] = [];

        handle.onsend = error => {
            const entry = this[kSendQueue].shift();

            if (entry) {
                if (error) {
                    entry.reject(error);
                } else {
                    entry.resolve();
                }
            }
        };
    }

    get readable() {
        if (!this[kReadable]) {
            const handle = this[kHandle];
            let receiving = false;

            this[kReadable] = new ReadableStream({
                start(controller) {
                    handle.onrecv = (msg, error) => {
                        if (error) {
                            handle.stopRecv();
                            receiving = false;
                            handle.onrecv = null;
                            controller.error(error);
                        } else {
                            controller.enqueue(msg);

                            if (receiving) {
                                handle.stopRecv();
                                receiving = false;
                            }
                        }
                    };
                },
                pull() {
                    if (!receiving) {
                        receiving = true;
                        handle.startRecv();
                    }
                },
                cancel() {
                    if (receiving) {
                        handle.stopRecv();
                        receiving = false;
                    }

                    handle.onrecv = null;
                }
            });
        }

        return this[kReadable];
    }

    get writable() {
        if (!this[kWritable]) {
            const handle = this[kHandle];
            const queue = this[kSendQueue];

            this[kWritable] = new WritableStream({
                async write({ data, addr }, controller) {
                    try {
                        const result = handle.send(data, addr);

                        if (typeof result !== 'number') {
                            const { promise, resolve, reject } = Promise.withResolvers();

                            queue.push({ resolve, reject });
                            await promise;
                        }
                    } catch (e) {
                        controller.error(e);
                    }
                }
            });
        }

        return this[kWritable];
    }

    get localAddress() {
        if (!this[kLocalAddress]) {
            this[kLocalAddress] = this[kHandle].getsockname();
        }

        return this[kLocalAddress];
    }

    get remoteAddress() {
        // Don't cache remote address since the socket might not be connected, ever.
        return this[kHandle].getpeername();
    }

    close() {
        this[kHandle].close();
    }
}
