// Sample TCP echo client.
//

import { getopts } from '@quv/getopts';
import { addr, logError } from './utils.js';


(async () => {
    const options = getopts(quv.args.slice(2), {
        alias: {
            connect: 'c',
            port: 'p'
        },
        default: {
            connect: '127.0.0.1',
            port: 1234
        }
    });

    const t = new quv.TCP();
    
    await t.connect({ip: options.connect, port: options.port});
    
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
