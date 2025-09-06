import { isIP, lookup } from './lookup.js';
import { readableStreamForHandle, writableStreamForHandle } from './stream-utils.js';

const core = globalThis[Symbol.for('tjs.internal.core')];

const kOnConnection = Symbol('kOnConnection');

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
    const addr = await resolveAddress(transport, host, port);

    switch (transport) {
        case 'tcp': {
            const handle = new core.TCP();
            let flags = 0;

            if (options.ipv6Only) {
                flags |= core.TCP_IPV6ONLY;
            }

            handle.bind(addr, flags);

            const l=new Listener(handle);

            handle.listen(handle=>{
                l[kOnConnection](handle);
            },options.backlog);

            return l;
        }

        case 'pipe': {
            const handle = new core.Pipe();

            handle.bind(addr);

            const l=new Listener(handle);

            handle.listen(handle=>{
                l[kOnConnection](handle);
            },options.backlog);

            return l;
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
    }

    #handleQueue=[];
    #acceptQueue=[];
    [kOnConnection](handle) {
        if (this.#acceptQueue.length>0) {
            this.#acceptQueue.shift().resolve(handle);
        } else {
            this.#handleQueue.push(handle);
        }
    }

    get localAddress() {
        if (!this[kLocalAddress]) {
            this[kLocalAddress] = this[kHandle].getsockname();
        }

        return this[kLocalAddress];
    }

    async accept() {
        let handle;

        if (this.#handleQueue.length>0) {
            handle=this.#handleQueue.shift();
        } else {
            handle=await new Promise((resolve,reject)=>{
                this.#acceptQueue.push({ resolve,reject });
            });
        }


        if (typeof handle === 'undefined') {
            return;
        }

        if (handle instanceof Error) {
            throw handle;
        }

        return new Connection(handle);
    }

    close() {
        this[kHandle].close();

        for (let v1 of this.#acceptQueue) {
            v1.reject(new Error('closed'));
        }

        this.#handleQueue=[];
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
