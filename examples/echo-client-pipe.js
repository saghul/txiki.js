// Sample Pipe echo client.
//

import { logError } from './utils.js';


(async () => {
    const p = new quv.Pipe();
    
    await p.connect(quv.args[2] || '/tmp/fooPipe');
    
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
