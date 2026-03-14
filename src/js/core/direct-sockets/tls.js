import { resolveAddress } from '../lookup.js';

import {
    core,
    kHandle,
    kOpened,
    silentClose,
    BaseStreamSocket,
    BaseStreamServerSocket
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

        this[kOpened] = this._setup(remoteAddress, remotePort, options);
    }

    async _setup(remoteAddress, remotePort, options) {
        const handle = this[kHandle];

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
                ...formatTLSAddress(localAddr, remoteAddr),
                alpn: handle.getAlpn(),
            };
        } catch (error) {
            silentClose(handle);
            this._closedReject(error);
            throw error;
        }
    }
}


export class TLSServerSocket extends BaseStreamServerSocket {
    constructor(localAddress, options = {}) {
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

        this[kOpened] = this._bind(localAddress, options);
    }

    async _bind(localAddress, options) {
        const handle = this[kHandle];

        try {
            const addr = await resolveAddress(localAddress, options.localPort ?? 0);

            let flags = 0;

            if (options.ipv6Only) {
                flags |= core.TCP_IPV6ONLY;
            }

            handle.bind(addr, flags);
            handle.listen(options.backlog);

            const createSocket = clientHandle =>
                this._createAcceptedSocket(TLSSocket.prototype, clientHandle, formatTLSAddress);

            const readable = this._createAcceptStream(createSocket);

            const localAddr = handle.getsockname();

            return {
                readable,
                localAddress: localAddr.ip,
                localPort: localAddr.port,
            };
        } catch (error) {
            silentClose(handle);
            this._closedReject(error);
            throw error;
        }
    }
}
