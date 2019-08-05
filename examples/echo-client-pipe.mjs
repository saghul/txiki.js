// Sample Pipe echo client.
//

'use strict';

import { logError } from './utils.js';


(async () => {
    const p = new uv.Pipe();
    
    await p.connect(global.scriptArgs[1] || '/tmp/fooPipe');
    
    console.log(`Connected to ${p.getpeername()}`);

    let data;
    while (true) {
        data = await p.read();
        //console.log(String.fromCharCode.apply(null, new Uint8Array(data)))
        if (!data) {
            console.log('connection closed!');
            break;
        }
        p.write(data);
    }

})().catch(logError);
