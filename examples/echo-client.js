// Sample TCP echo client.
//

import getopts from 'tjs:getopts';


const options = getopts(tjs.args.slice(2), {
    alias: {
        connect: 'c',
        port: 'p'
    },
    default: {
        connect: '127.0.0.1',
        port: 1234
    }
});

const client = new TCPSocket(options.connect, options.port);
const { readable, writable, remoteAddress, remotePort } = await client.opened;

console.log(`Connected to ${remoteAddress}:${remotePort}`);

await readable.pipeTo(writable);
console.log('connection closed!');
