const core = globalThis[Symbol.for('tjs.internal.core')];
const posixSocketInt = core.posix_socket;

export let PosixSocket;

if (posixSocketInt) {
    PosixSocket = class PosixSocket {
        constructor(domain, type, protocol) {
            if (Object.getPrototypeOf(domain) === posixSocketInt.PosixSocketProto) { // internal posix socket class
                this._psock = domain;
            } else {
                this._psock = new posixSocketInt.PosixSocket(domain, type, protocol);
            }
        }

        get info() {
            return this._psock.info;
        }

        get fileno() {
            return this._psock.fileno;
        }

        get polling() {
            return this._psock.polling;
        }

        static defines = Object.freeze(posixSocketInt.defines);
        static createFromFD(fd) {
            return new PosixSocket(posixSocketInt.posix_socket_from_fd(fd));
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
            return new PosixSocket(this._psock.accept(...args));
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
            return posixSocketInt.sizeof_struct_sockaddr;
        }

        static createSockaddrIn(ip, port) {
            return posixSocketInt.create_sockaddr_inet({ ip, port });
        }

        static pollEvents = Object.freeze(posixSocketInt.uv_poll_event_bits);

        static indextoname(index) {
            return posixSocketInt.if_indextoname(index);
        }
        static nametoindex(name) {
            return posixSocketInt.if_nametoindex(name);
        }
        static checksum(buf) {
            return posixSocketInt.checksum(buf);
        }
    };
}
