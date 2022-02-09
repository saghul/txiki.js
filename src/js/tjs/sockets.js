const core = globalThis.__bootstrap;


export async function connect(transport, host, port, options = {}) {
    const addr = await prepareAddress(transport, host, port);

    switch (transport) {
        case 'tcp': {
            const handle = new core.TCP();
            if (options.bindAddr) {
                handle.bind(options.bindAddr);
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
                handle.bind(options.bindAddr);
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
            handle.bind(addr);
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
            handle.bind(addr);
            return new DatagramEndpoint(handle);
        }
    }
}

async function prepareAddress(transport, host='0.0.0.0', port=0) {
    switch (transport) {
        case 'tcp': {
            const opts = {
                socktype: tjs.SOCK_STREAM,
                protocol: tjs.IPPROTO_TCP
            };
            const r = await tjs.getaddrinfo(host, port, opts);
            return r[0];
        }
        case 'pipe':
            return host;
        case 'udp': {
            const opts = {
                socktype: tjs.SOCK_DGRAM,
                protocol: tjs.IPPROTO_UDP
            };
            const r = await tjs.getaddrinfo(host, port, opts);
            return r[0];
        }
        default:
            throw new Error('invalid transport');
    }
}

const kHandle = Symbol('kHandle');

class Connection {
    constructor(handle) {
        this[kHandle] = handle;
    }

    async read(buf) {
        return this[kHandle].read(buf);
    }

    async write(buf) {
        return this[kHandle].write(buf);
    }

    get localAddress() {
        return this[kHandle].getsockname();
    }

    get remoteAddress() {
        return this[kHandle].getpeername();
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
        return this[kHandle].getsockname();
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

    async recv(buf) {
        return this[kHandle].recv(buf);
    }

    async send(buf, taddr) {
        return this[kHandle].send(buf, taddr);
    }

    get localAddress() {
        return this[kHandle].getsockname();
    }

    get remoteAddress() {
        return this[kHandle].getpeername();
    }

    close() {
        this[kHandle].close();
    }
}
