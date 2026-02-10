import { PipeSocket, PipeServerSocket } from './pipe.js';
import { TCPSocket, TCPServerSocket } from './tcp.js';
import { UDPSocket } from './udp.js';

export { TCPSocket, TCPServerSocket, UDPSocket, PipeSocket, PipeServerSocket };

const globals = {
    TCPSocket,
    TCPServerSocket,
    UDPSocket,
    PipeSocket,
    PipeServerSocket
};

for (const [ name, value ] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, {
        enumerable: true,
        configurable: true,
        writable: true,
        value
    });
}
