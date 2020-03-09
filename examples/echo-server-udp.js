// Sample UDP echo server.
//

import { addr } from './utils.js';


(async () => {
    const u = new tjs.UDP();

    u.bind({ip: tjs.args[2] || '127.0.0.1', port: tjs.args[3] || 1234});
    console.log(`Listening on ${addr(u.getsockname())}`); 

    let rinfo;
    while (true) {
        rinfo = await u.recv();
        console.log(rinfo.data[Symbol.toStringTag]);
        //console.log(JSON.stringify(rinfo));
        u.send(rinfo.data, rinfo.addr);
        if (new TextDecoder().decode(rinfo.data) === 'quit\n') {
            break;
        }
    }

    u.close();

    console.log('END');
})();
