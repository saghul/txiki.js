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


function formatTLSAddress(localAddr, remoteAddr) {
    return {
        localAddress: localAddr.ip,
        localPort: localAddr.port,
        remoteAddress: remoteAddr.ip,
        remotePort: remoteAddr.port,
    };
}


export class TLSSocket extends BaseStreamSocket {
    constructor(remoteAddress, remotePort, options = {}) {
        if (!core.TLSTcp) {
            throw new Error('TLS not supported in this build');
        }

        if (typeof remoteAddress !== 'string') {
            throw new TypeError('remoteAddress must be a string');
        }

        if (typeof remotePort !== 'number' || remotePort < 0 || remotePort > 65535) {
            throw new TypeError('remotePort must be a number between 0 and 65535');
        }

        const tlsOptions = {
            isServer: false,
            sni: options.sni ?? remoteAddress,
            alpn: options.alpn,
            ca: options.ca,
            cert: options.cert,
            key: options.key,
            verifyPeer: options.verifyPeer,
        };

        super(new core.TLSTcp(tlsOptions));

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

            await this._connect(addr, options.signal);

            const localAddr = handle.getsockname();
            const remoteAddr = handle.getpeername();

            return {
                ...this._buildOpenedInfo(),
                ...formatTLSAddress(localAddr, remoteAddr),
                alpn: handle.getAlpn(),
            };
        } catch (error) {
            silentClose(handle);
            this[kRejectClosed](error);
            throw error;
        }
    }
}


export class TLSServerSocket extends BaseStreamServerSocket {
    constructor(localAddress, options = {}) {
        if (!core.TLSTcp) {
            throw new Error('TLS not supported in this build');
        }

        if (typeof localAddress !== 'string') {
            throw new TypeError('localAddress must be a string');
        }

        if (typeof options.cert !== 'string' || typeof options.key !== 'string') {
            throw new TypeError('tls server requires cert and key PEM strings');
        }

        const tlsOptions = {
            isServer: true,
            cert: options.cert,
            key: options.key,
            ca: options.ca,
            verifyPeer: options.verifyPeer,
            alpn: options.alpn,
        };

        super(new core.TLSTcp(tlsOptions));

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
                this._createAcceptedSocket(TLSSocket, clientHandle, formatTLSAddress);

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
