import { resolveAddress } from '../lookup.js';

import {
    core,
    silentClose,
    BaseStreamSocket,
    BaseStreamServerSocket,
    kSetOpened,
    kGetHandle,
    kRejectClosed
} from './utils.js';


function formatTCPAddress(localAddr, remoteAddr) {
    return {
        localAddress: localAddr.ip,
        localPort: localAddr.port,
        remoteAddress: remoteAddr.ip,
        remotePort: remoteAddr.port,
    };
}


export class TCPSocket extends BaseStreamSocket {
    constructor(remoteAddress, remotePort, options = {}) {
        if (typeof remoteAddress !== 'string') {
            throw new TypeError('remoteAddress must be a string');
        }

        if (typeof remotePort !== 'number' || remotePort < 0 || remotePort > 65535) {
            throw new TypeError('remotePort must be a number between 0 and 65535');
        }

        super(new core.TCP());

        this[kSetOpened](this.#setup(remoteAddress, remotePort, options));
    }

    async #setup(remoteAddress, remotePort, options) {
        const handle = this[kGetHandle]();

        try {
            const addr = await resolveAddress(remoteAddress, remotePort, options.dnsQueryType);

            if (options.noDelay) {
                handle.setNoDelay(true);
            }

            if (options.keepAliveDelay) {
                handle.setKeepAlive(true, options.keepAliveDelay);
            }

            await this._connect(addr);

            const localAddr = handle.getsockname();
            const remoteAddr = handle.getpeername();

            return {
                ...this._buildOpenedInfo(),
                ...formatTCPAddress(localAddr, remoteAddr),
            };
        } catch (error) {
            silentClose(handle);
            this[kRejectClosed](error);
            throw error;
        }
    }
}


export class TCPServerSocket extends BaseStreamServerSocket {
    constructor(localAddress, options = {}) {
        if (typeof localAddress !== 'string') {
            throw new TypeError('localAddress must be a string');
        }

        super(new core.TCP());

        this[kSetOpened](this.#bind(localAddress, options));
    }

    async #bind(localAddress, options) {
        const handle = this[kGetHandle]();

        try {
            const addr = await resolveAddress(localAddress, options.localPort ?? 0);

            let flags = 0;

            if (options.ipv6Only) {
                flags |= core.TCP_IPV6ONLY;
            }

            handle.bind(addr, flags);
            handle.listen(options.backlog);

            const createSocket = clientHandle =>
                this._createAcceptedSocket(TCPSocket, clientHandle, formatTCPAddress);

            const readable = this._createAcceptStream(createSocket);

            const localAddr = handle.getsockname();

            return {
                readable,
                localAddress: localAddr.ip,
                localPort: localAddr.port,
            };
        } catch (error) {
            silentClose(handle);
            this[kRejectClosed](error);
            throw error;
        }
    }
}
