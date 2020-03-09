// Sample TCP echo server.
//

import { getopts } from '@tjs/getopts';
import { addr } from './utils.js';


async function handleConnection(conn) {
    console.log(`Accepted connection! ${addr(conn.getpeername())} <-> ${addr(conn.getsockname())}`);

    let data;
    while (true) {
        data = await conn.read();
        //console.log(String.fromCharCode.apply(null, new Uint8Array(buf, 0, nread)));
        if (!data) {
            console.log('connection closed!');
            break;
        }
        conn.write(data);
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

    const t = new tjs.TCP();

    t.bind({ip: options.listen, port: options.port});
    t.listen();

    console.log(`Listening on ${addr(t.getsockname())}`); 

    let conn;
    while (true) {
        conn = await t.accept();
        handleConnection(conn);
        conn = undefined;
    }

})();
