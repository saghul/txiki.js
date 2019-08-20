// Sample UDP echo server.
//

import { addr, logError } from './utils.js';


(async () => {
    const u = new uv.UDP();

    u.bind({ip: global.scriptArgs[2] || '127.0.0.1', port: global.scriptArgs[3] || 1234});
    console.log(`Listening on ${addr(u.getsockname())}`); 

    let buf = new ArrayBuffer(1024);
    let rinfo;
    while (true) {
        rinfo = await u.recv(buf);
        console.log(JSON.stringify(rinfo));
        await u.send(buf, 0, rinfo.nread, rinfo.addr);
    }

})().catch(logError);
