// Sample TCP echo server.
//

import { getopts } from '@tjs/std';
import { addr } from './utils.js';


async function handleConnection(conn) {
    console.log(`Accepted connection! ${addr(conn.localAddress)} <-> ${addr(conn.remoteAddress)}`);

    const buf = new Uint8Array(65536);
    while (true) {
        const nread = await conn.read(buf);
        if (!nread) {
            console.log('connection closed!');
            break;
        }
        await conn.write(buf.subarray(0, nread));
    }
}

(async () => {
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

    const l = await tjs.listen('tcp', options.listen, options.port);

    console.log(`Listening on ${addr(l.localAddress)}`); 

    for await (let conn of l) {
        handleConnection(conn);
        conn = undefined;
    }

})();
