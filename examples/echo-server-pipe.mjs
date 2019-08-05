// Sample TCP echo server.
//

'use strict';

import { logError } from './utils.js';


async function handleConnection(conn) {
    console.log(`Accepted connection! ${conn.getpeername()} <-> ${conn.getsockname()}`);

    let data;
    while (true) {
        data = await conn.read();
        //console.log(String.fromCharCode.apply(null, new Uint8Array(data)))
        if (!data) {
            console.log('connection closed!');
            break;
        }
        conn.write(data);
    }
}

(async () => {
    const p = new uv.Pipe();

    p.bind(global.scriptArgs[1] || '/tmp/fooPipe');
    p.listen();

    console.log(`Listening on ${p.getsockname()}`); 

    let conn;
    while (true) {
        conn = await p.accept();
        handleConnection(conn);
        conn = undefined;
    }

})().catch(logError);
