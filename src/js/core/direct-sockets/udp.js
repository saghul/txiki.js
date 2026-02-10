import { resolveAddress } from '../lookup.js';

import {
    core,
    kHandle,
    kOpened,
    kClosed,
    silentClose,
} from './utils.js';


export class UDPSocket {
    constructor(options = {}) {
        const hasRemote = options.remoteAddress !== undefined && options.remotePort !== undefined;
        const hasLocal = options.localAddress !== undefined;

        if (!hasRemote && !hasLocal) {
            throw new TypeError('UDPSocket requires remoteAddress+remotePort or localAddress');
        }

        const handle = new core.UDP();

        this[kHandle] = handle;
        this._pendingSend = null;

        handle.onsend = error => {
            const pending = this._pendingSend;

            if (pending) {
                this._pendingSend = null;

                if (error) {
                    pending.reject(error);
                } else {
                    pending.resolve();
                }
            }
        };

        const { promise: closedPromise, resolve: closedResolve, reject: closedReject } = Promise.withResolvers();

        this[kClosed] = closedPromise;
        this._closedResolve = closedResolve;
        this._closedReject = closedReject;

        this[kOpened] = this._setup(options, hasRemote);
    }

    _createReadableStream(isConnected) {
        const handle = this[kHandle];
        let receiving = false;

        return new ReadableStream({
            start(controller) {
                handle.onrecv = (msg, error) => {
                    if (error) {
                        handle.stopRecv();
                        receiving = false;
                        handle.onrecv = null;
                        controller.error(error);
                    } else {
                        const message = { data: msg.data };

                        if (!isConnected && msg.addr) {
                            message.remoteAddress = msg.addr.ip;
                            message.remotePort = msg.addr.port;
                        }

                        controller.enqueue(message);

                        if (controller.desiredSize <= 0) {
                            handle.stopRecv();
                            receiving = false;
                        }
                    }
                };

                receiving = true;
                handle.startRecv();
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

    _createWritableStream(isConnected) {
        const handle = this[kHandle];

        return new WritableStream({
            write: async (chunk, controller) => {
                try {
                    let addr;

                    if (!isConnected) {
                        if (!chunk.remoteAddress || chunk.remotePort === undefined) {
                            throw new TypeError(
                                'Unconnected UDPSocket requires remoteAddress and remotePort in each message');
                        }

                        addr = { ip: chunk.remoteAddress, port: chunk.remotePort };
                    }

                    const result = handle.send(chunk.data, addr);

                    if (typeof result !== 'number') {
                        const { promise, resolve, reject } = Promise.withResolvers();

                        this._pendingSend = { resolve, reject };
                        await promise;
                    }
                } catch (e) {
                    controller.error(e);
                }
            }
        });
    }

    async _setup(options, isConnected) {
        const handle = this[kHandle];

        try {
            if (options.localAddress !== undefined) {
                const localAddr = await resolveAddress(
                    options.localAddress,
                    options.localPort ?? 0,
                    options.dnsQueryType
                );
                let flags = 0;

                if (options.reuseAddr) {
                    flags |= core.UDP_REUSEADDR;
                }

                if (options.ipv6Only) {
                    flags |= core.UDP_IPV6ONLY;
                }

                handle.bind(localAddr, flags);
            }

            const openedInfo = {};

            if (isConnected) {
                const remoteAddr = await resolveAddress(
                    options.remoteAddress,
                    options.remotePort,
                    options.dnsQueryType
                );

                handle.connect(remoteAddr);

                const peerAddr = handle.getpeername();

                openedInfo.remoteAddress = peerAddr.ip;
                openedInfo.remotePort = peerAddr.port;
            }

            openedInfo.readable = this._createReadableStream(isConnected);
            openedInfo.writable = this._createWritableStream(isConnected);

            const localAddr = handle.getsockname();

            openedInfo.localAddress = localAddr.ip;
            openedInfo.localPort = localAddr.port;

            return openedInfo;
        } catch (error) {
            silentClose(handle);
            this._closedReject(error);
            throw error;
        }
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
