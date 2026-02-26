// Sample TCP echo server.
//

import getopts from 'tjs:getopts';


async function handleConnection(conn) {
    const { readable, writable, localAddress, localPort, remoteAddress, remotePort } = await conn.opened;

    console.log(`Accepted connection! ${localAddress}:${localPort} <-> ${remoteAddress}:${remotePort}`);

    await readable.pipeTo(writable);
    console.log('connection closed!');
}

const options = getopts(tjs.args.slice(2), {
    alias: {
        listen: 'l',
        port: 'p'
    },
    default: {
        listen: '127.0.0.1',
        port: 1234
    }
});

const server = new TCPServerSocket(options.listen, { localPort: options.port });
const { readable, localAddress, localPort } = await server.opened;

console.log(`Listening on ${localAddress}:${localPort}`);

const reader = readable.getReader();

while (true) {
    const { value: conn, done } = await reader.read();

    if (done) {
        break;
    }

    handleConnection(conn);
}
