import { isIP, lookup } from './lookup.js';
import {
    initWriteQueue, writeWithQueue, readableStreamForHandle, writableStreamForHandle
} from './stream-utils.js';

const core = globalThis[Symbol.for('tjs.internal.core')];


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

    write(buf) {
        return writeWithQueue(this[kHandle], this[kWriteQueue], buf);
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
                    handle.onrecv = msg => {
                        if (msg instanceof Error) {
                            controller.error(msg);
                        } else if (typeof msg === 'undefined') {
                            controller.close();
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
                    receiving = true;
                    handle.startRecv();
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
            const endpoint = this;

            this[kWritable] = new WritableStream({
                async write({ data, addr }, controller) {
                    try {
                        await endpoint.send(data, addr);
                    } catch (e) {
                        controller.error(e);
                    }
                }
            });
        }

        return this[kWritable];
    }

    send(buf, taddr) {
        const result = this[kHandle].send(buf, taddr);

        if (typeof result === 'number') {
            return Promise.resolve(result);
        }

        const { promise, resolve, reject } = Promise.withResolvers();

        this[kSendQueue].push({ resolve, reject });

        return promise;
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
