import {
    core,
    kHandle,
    kOpened,
    silentClose,
    BaseStreamSocket,
    BaseStreamServerSocket
} from './utils.js';


function formatPipeAddress(localAddr, remoteAddr) {
    return {
        localAddress: localAddr,
        remoteAddress: remoteAddr,
    };
}


export class PipeSocket extends BaseStreamSocket {
    constructor(path) {
        if (typeof path !== 'string') {
            throw new TypeError('path must be a string');
        }

        super(new core.Pipe());

        this[kOpened] = this._setup(path);
    }

    async _setup(path) {
        const handle = this[kHandle];

        try {
            await this._connect(path);

            const localAddr = handle.getsockname();
            const remoteAddr = handle.getpeername();

            return {
                ...this._buildOpenedInfo(),
                ...formatPipeAddress(localAddr, remoteAddr),
            };
        } catch (error) {
            silentClose(handle);
            this._closedReject(error);
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

        this[kOpened] = this._bind(path, options);
    }

    async _bind(path, options) {
        const handle = this[kHandle];

        try {
            handle.bind(path);
            handle.listen(options.backlog);

            const createSocket = clientHandle =>
                this._createAcceptedSocket(PipeSocket.prototype, clientHandle, formatPipeAddress);

            const readable = this._createAcceptStream(createSocket);

            const localAddr = handle.getsockname();

            return {
                readable,
                localAddress: localAddr,
            };
        } catch (error) {
            silentClose(handle);
            this._closedReject(error);
            throw error;
        }
    }
}
