// Sample TCP echo server.
//

'use strict';

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
        conn.write(buf.slice(0, nread));
    }
}

(async () => {
    const t = new uv.TCP();

    t.bind({ip: global.scriptArgs[1] || '127.0.0.1', port: global.scriptArgs[2] || 1234});
    t.listen();

    console.log(`Listening on ${addr(t.getsockname())}`); 

    let conn;
    while (true) {
        conn = await t.accept();
        handleConnection(conn);
        conn = undefined;
    }

})().catch(logError);
