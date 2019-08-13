// Sample Pipe echo client.
//

'use strict';

import { logError } from './utils.js';


(async () => {
    const p = new uv.Pipe();
    
    await p.connect(global.scriptArgs[1] || '/tmp/fooPipe');
    
    console.log(`Connected to ${p.getpeername()}`);

    const buf = new ArrayBuffer(4096);
    let nread;
    while (true) {
        nread = await p.read(buf);
        //console.log(String.fromCharCode.apply(null, new Uint8Array(buf, 0, nread)));
        if (!nread) {
            console.log('connection closed!');
            break;
        }
        p.write(buf.slice(0, nread));
    }

})().catch(logError);
