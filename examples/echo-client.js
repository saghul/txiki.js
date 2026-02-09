// Sample TCP echo client.
//

import getopts from 'tjs:getopts';

import { addr } from './utils.js';


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

const conn = await tjs.connect('tcp', options.connect, options.port);

console.log(`Connected to ${addr(conn.remoteAddress)}`);

await conn.readable.pipeTo(conn.writable);
console.log('connection closed!');
