// Sample TCP echo client.
//

import { getopts } from '@tjs/std';
import { addr } from './utils.js';


(async () => {
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

    const buf = new Uint8Array(65536);
    while (true) {
        const nread = await conn.read(buf);
        if (!nread) {
            console.log('connection closed!');
            break;
        }
        //console.log(`Received: ${new TextDecoder().decode(data)}`);
        await conn.write(buf.subarray(0, nread));
    }
})();
