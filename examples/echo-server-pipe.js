// Sample Pipe echo server.
//

import { logError } from './utils.js';


async function handleConnection(conn) {
    console.log(`Accepted connection! ${conn.getpeername()} <-> ${conn.getsockname()}`);

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
    const p = new quv.Pipe();

    p.bind(quv.args[2] || '/tmp/fooPipe');
    p.listen();

    console.log(`Listening on ${p.getsockname()}`); 

    let conn;
    while (true) {
        conn = await p.accept();
        handleConnection(conn);
        conn = undefined;
    }

})().catch(logError);
