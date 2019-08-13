// Sample TCP echo client.
//

'use strict';

import { addr, logError } from './utils.js';


(async () => {
    const t = new uv.TCP();
    
    await t.connect({ip: global.scriptArgs[1] || '127.0.0.1', port: global.scriptArgs[2] || 1234});
    
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
