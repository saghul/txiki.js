import { PipeSocket, PipeServerSocket } from './direct-sockets/pipe.js';
import { TCPSocket, TCPServerSocket } from './direct-sockets/tcp.js';
import { UDPSocket } from './direct-sockets/udp.js';
import { isIP, lookup } from './lookup.js';


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

export async function connect(transport, host, port, options = {}) {
    switch (transport) {
        case 'tcp': {
            const socket = new TCPSocket(host, port, {
                noDelay: options.noDelay,
                keepAliveDelay: options.keepAliveDelay,
                dnsQueryType: options.dnsQueryType,
            });

            await socket.opened;

            return socket;
        }

        case 'pipe': {
            if (typeof host !== 'string') {
                throw new TypeError('pipe path must be a string');
            }

            const socket = new PipeSocket(host);

            await socket.opened;

            return socket;
        }

        case 'udp': {
            const addr = await resolveAddress(transport, host, port);
            const udpOptions = {
                remoteAddress: addr.ip,
                remotePort: addr.port,
            };

            if (options.bindAddr) {
                udpOptions.localAddress = options.bindAddr.ip;
                udpOptions.localPort = options.bindAddr.port;
            }

            if (options.ipv6Only) {
                udpOptions.ipv6Only = true;
            }

            const socket = new UDPSocket(udpOptions);

            await socket.opened;

            return socket;
        }

        default:
            throw new Error('invalid transport');
    }
}

export async function listen(transport, host, port, options = {}) {
    switch (transport) {
        case 'tcp': {
            const addr = await resolveAddress(transport, host, port);

            const server = new TCPServerSocket(addr.ip, {
                localPort: addr.port,
                backlog: options.backlog,
                ipv6Only: options.ipv6Only,
            });

            await server.opened;

            return server;
        }

        case 'pipe': {
            if (typeof host !== 'string') {
                throw new TypeError('pipe path must be a string');
            }

            const server = new PipeServerSocket(host, {
                backlog: options.backlog,
            });

            await server.opened;

            return server;
        }

        case 'udp': {
            const addr = await resolveAddress(transport, host, port);
            const udpOptions = {
                localAddress: addr.ip,
                localPort: addr.port,
            };

            if (options.reuseAddr) {
                udpOptions.reuseAddr = true;
            }

            if (options.ipv6Only) {
                udpOptions.ipv6Only = true;
            }

            const socket = new UDPSocket(udpOptions);

            await socket.opened;

            return socket;
        }

        default:
            throw new Error('invalid transport');
    }
}
