// Sample TCP echo client.
//

'use strict';

import { addr, logError } from './utils.js';


(async () => {
    const t = new uv.TCP();
    
    await t.connect({ip: global.scriptArgs[1] || '127.0.0.1', port: global.scriptArgs[2] || 1234});
    
    console.log(`Connected to ${addr(t.getpeername())}`);

    let data;
    while (true) {
        data = await t.read();
        //console.log(String.fromCharCode.apply(null, new Uint8Array(data)))
        if (!data) {
            console.log('connection closed!');
            break;
        }
        await t.write(data);
    }

})().catch(logError);
