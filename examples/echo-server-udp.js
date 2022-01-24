// Sample UDP echo server.
//

import { addr } from './utils.js';


(async () => {
    const u = new tjs.UDP();

    u.bind({ip: tjs.args[2] || '127.0.0.1', port: tjs.args[3] || 1234});
    console.log(`Listening on ${addr(u.getsockname())}`); 

    const decoder = new TextDecoder();
    const dataBuf = new Uint8Array(1024);
    let rinfo;
    while (true) {
        rinfo = await u.recv(dataBuf);
        const data = dataBuf.subarray(0, rinfo.nread);
        await u.send(data, rinfo.addr);
        if (decoder.decode(data) === 'quit\n') {
            break;
        }
    }

    u.close();

    console.log('END');
})();
