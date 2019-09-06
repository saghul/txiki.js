// Sample TCP echo server.
//

import { getopts } from '@quv/getopts';
import { addr, logError } from './utils.js';


async function handleConnection(conn) {
    console.log(`Accepted connection! ${addr(conn.getpeername())} <-> ${addr(conn.getsockname())}`);

    const buf = new ArrayBuffer(4096);
    let nread;
    while (true) {
        nread = await conn.read(buf);
        //console.log(String.fromCharCode.apply(null, new Uint8Array(buf, 0, nread)));
        if (!nread) {
            console.log('connection closed!');
            break;
        }
        await conn.write(buf, 0, nread);
    }
}

(async () => {
    const options = getopts(quv.args.slice(2), {
        alias: {
            listen: 'l',
            port: 'p'
        },
        default: {
            listen: '127.0.0.1',
            port: 1234
        }
    });

    const t = new quv.TCP();

    t.bind({ip: options.listen, port: options.port});
    t.listen();

    console.log(`Listening on ${addr(t.getsockname())}`); 

    let conn;
    while (true) {
        conn = await t.accept();
        handleConnection(conn);
        conn = undefined;
    }

})().catch(logError);
