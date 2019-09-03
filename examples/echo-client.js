// Sample TCP echo client.
//

import { addr, logError } from './utils.js';


(async () => {
    const t = new quv.TCP();
    
    await t.connect({ip: quv.args[2] || '127.0.0.1', port: quv.args[3] || 1234});
    
    console.log(`Connected to ${addr(t.getpeername())}`);

    const buf = new ArrayBuffer(4096);
    let nread;
    while (true) {
        nread = await t.read(buf);
        //console.log(String.fromCharCode.apply(null, new Uint8Array(buf, 0, nread)));
        if (!nread) {
            console.log('connection closed!');
            break;
        }
        t.write(buf.slice(0, nread));
    }

})().catch(logError);
