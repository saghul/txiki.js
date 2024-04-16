const core = globalThis[Symbol.for('tjs.internal.core')];
const posixSocket = core.posix_socket;

export let PosixSocket;

if (posixSocket) {
    PosixSocket = class PosixSocket {
        constructor(domain, type, protocol) {
            this._psock = new posixSocket.PosixSocket(domain, type, protocol);
            this._info = {
                socket: { domain, type, protocol }
            };
        }

        get info() {
            return this._info;
        }

        get fileno() {
            return this._psock.fileno;
        }

        get polling() {
            return this._psock.polling;
        }

        static defines = Object.freeze(posixSocket.defines);
        static createFromFD(fd) {
            return posixSocket.posix_socket_from_fd(fd);
        }

        bind(...args) {
            return this._psock.bind(...args);
        }
        connect(...args) {
            return this._psock.connect(...args);
        }
        listen(...args) {
            return this._psock.listen(...args);
        }
        accept(...args) {
            return this._psock.accept(...args);
        }
        sendmsg(...args) {
            return this._psock.sendmsg(...args);
        }
        recv(...args) {
            return this._psock.recv(...args);
        }
        recvmsg(...args) {
            return this._psock.recvmsg(...args);
        }
        close(...args) {
            return this._psock.close(...args);
        }
        setopt(...args) {
            return this._psock.setopt(...args);
        }
        getopt(...args) {
            return this._psock.getopt(...args);
        }
        read(...args) {
            return this._psock.read(...args);
        }
        write(...args) {
            return this._psock.write(...args);
        }

        poll(cbs) {
            this._cbs = {
                read: undefined,
                write: undefined,
                disconnect: undefined,
                prioritized: undefined,
                error: undefined,
                all: undefined,
            };

            for (const k in this._cbs) {
                if (cbs[k]) {
                    this._cbs[k] = cbs[k];
                }
            }

            this._handleEvent = (status, events) => {
                if (status !== 0) {
                    if (this._cbs.error) {
                        this._cbs.error(status, events);
                    } else {
                        console.error('uv_poll unhandled error:', status);
                    }
                } else {
                    this._cbs.all?.(events);

                    if (events & PosixSocket.pollEvents.READABLE && this._cbs.read) {
                        this._cbs.read(events);
                    }

                    if (events & PosixSocket.pollEvents.WRITABLE && this._cbs.write) {
                        this._cbs.write(events);
                    }

                    if (events & PosixSocket.pollEvents.DISCONNECT && this._cbs.disconnect) {
                        this._cbs.disconnect(events);
                    }

                    if (events & PosixSocket.pollEvents.PRIORITIZED && this._cbs.prioritized) {
                        this._cbs.prioritized(events);
                    }
                }
            };

            let mask = 0;

            if (cbs.all) {
                mask = PosixSocket.pollEvents.READABLE |
                    PosixSocket.pollEvents.WRITABLE |
                    PosixSocket.pollEvents.DISCONNECT |
                    PosixSocket.pollEvents.PRIORITIZED;
            } else {
                if (cbs.read) {
                    mask |= PosixSocket.pollEvents.READABLE;
                }

                if (cbs.write) {
                    mask |= PosixSocket.pollEvents.WRITABLE;
                }

                if (cbs.disconnect) {
                    mask |= PosixSocket.pollEvents.DISCONNECT;
                }

                if (cbs.prioritized) {
                    mask |= PosixSocket.pollEvents.PRIORITIZED;
                }
            }

            this._psock.poll(mask, this._handleEvent);
        }

        stopPoll() {
            this._psock.pollStop();
        }

        static get sockaddrInSize() {
            return posixSocket.sizeof_struct_sockaddr;
        }

        static createSockaddrIn(ip, port) {
            return posixSocket.create_sockaddr_inet({ ip, port });
        }

        static pollEvents = Object.freeze(posixSocket.uv_poll_event_bits);

        static indextoname(index) {
            return posixSocket.if_indextoname(index);
        }
        static nametoindex(name) {
            return posixSocket.if_nametoindex(name);
        }
        static checksum(buf) {
            return posixSocket.checksum(buf);
        }
    };
}
