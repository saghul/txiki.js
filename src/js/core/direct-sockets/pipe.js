import {
    core,
    silentClose,
    BaseStreamSocket,
    BaseStreamServerSocket,
    kSetOpened,
    kGetHandle,
    kRejectClosed
} from './utils.js';


function formatPipeAddress(localAddr, remoteAddr) {
    return {
        localAddress: localAddr,
        remoteAddress: remoteAddr,
    };
}


export class PipeSocket extends BaseStreamSocket {
    constructor(path, options = {}) {
        if (typeof path !== 'string') {
            throw new TypeError('path must be a string');
        }

        super(new core.Pipe());

        this[kSetOpened](this.#setup(path, options));
    }

    async #setup(path, options) {
        const handle = this[kGetHandle]();

        try {
            await this._connect(path, options.signal);

            const localAddr = handle.getsockname();
            const remoteAddr = handle.getpeername();

            return {
                ...this._buildOpenedInfo(),
                ...formatPipeAddress(localAddr, remoteAddr),
            };
        } catch (error) {
            silentClose(handle);
            this[kRejectClosed](error);
            throw error;
        }
    }
}


export class PipeServerSocket extends BaseStreamServerSocket {
    constructor(path, options = {}) {
        if (typeof path !== 'string') {
            throw new TypeError('path must be a string');
        }

        super(new core.Pipe());

        this[kSetOpened](this.#bind(path, options));
    }

    async #bind(path, options) {
        const handle = this[kGetHandle]();

        try {
            handle.bind(path);
            handle.listen(options.backlog);

            const createSocket = clientHandle =>
                this._createAcceptedSocket(PipeSocket, clientHandle, formatPipeAddress);

            const readable = this._createAcceptStream(createSocket);

            const localAddr = handle.getsockname();

            return {
                readable,
                localAddress: localAddr,
            };
        } catch (error) {
            silentClose(handle);
            this[kRejectClosed](error);
            throw error;
        }
    }
}
