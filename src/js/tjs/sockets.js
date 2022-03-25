import { readableStreamForHandle, writableStreamForHandle } from './stream-utils.js';

const core = globalThis.__bootstrap;


export async function connect(transport, host, port, options = {}) {
    const addr = await prepareAddress(transport, host, port);

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
            await handle.connect(addr);
            return new Connection(handle);
        }
        case 'pipe': {
            const handle = new core.Pipe();
            await handle.connect(addr);
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
            await handle.connect(addr);
            return new DatagramEndpoint(handle);
        }
    }
}

export async function listen(transport, host, port, options = {}) {
    const addr = await prepareAddress(transport, host, port);

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
            handle.bind(addr, options.bindFlags);
            return new DatagramEndpoint(handle);
        }
    }
}

async function prepareAddress(transport, host, port) {
    switch (transport) {
        case 'tcp': {
            const opts = {
                socktype: tjs.SOCK_STREAM,
                protocol: tjs.IPPROTO_TCP
            };
            const r = await tjs.getaddrinfo(host ?? '0.0.0.0', port ?? 0, opts);
            return r[0];
        }
        case 'pipe':
            return host;
        case 'udp': {
            const opts = {
                socktype: tjs.SOCK_DGRAM,
                protocol: tjs.IPPROTO_UDP
            };
            const r = await tjs.getaddrinfo(host ?? '0.0.0.0', port ?? 0, opts);
            return r[0];
        }
        default:
            throw new Error('invalid transport');
    }
}

const kHandle = Symbol('kHandle');
const kLocalAddress = Symbol('kLocalAddress');
const kRemoteAddress = Symbol('kRemoteAddress');
const kReadable = Symbol('kReadable');
const kWritable = Symbol('kWritable');

class Connection {
    constructor(handle) {
        this[kHandle] = handle;
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
            this[kWritable] = writableStreamForHandle(this[kHandle]);
        }
        return this[kWritable];
    }

    read(buf) {
        return this[kHandle].read(buf);
    }

    write(buf) {
        return this[kHandle].write(buf);
    }

    setKeepAlive(enable = true) {
        this[kHandle].setKeepAlive(enable);
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
    }

    get localAddress() {
        if (!this[kLocalAddress]) {
            this[kLocalAddress] = this[kHandle].getsockname();
        }
        return this[kLocalAddress];
    }

    async accept() {
        const handle = await this[kHandle].accept();

        if (typeof handle === 'undefined') {
            return;
        }

        return new Connection(handle);
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
        }
    }
}

class DatagramEndpoint {
    constructor(handle) {
        this[kHandle] = handle;
    }

    recv(buf) {
        return this[kHandle].recv(buf);
    }

    send(buf, taddr) {
        return this[kHandle].send(buf, taddr);
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
