// Sample TCP echo client.
//

import { getopts } from '@tjs/getopts';
import { addr } from './utils.js';


(async () => {
    const options = getopts(tjs.args.slice(2), {
        alias: {
            connect: 'c',
            port: 'p'
        },
        default: {
            connect: '127.0.0.1',
            port: 1234
        }
    });

    const t = new tjs.TCP();
    
    await t.connect({ip: options.connect, port: options.port});
    
    console.log(`Connected to ${addr(t.getpeername())}`);

    let data;
    while (true) {
        data = await t.read();
        if (!data) {
            console.log('connection closed!');
            break;
        }
        //console.log(`Received: ${new TextDecoder().decode(data)}`);
        t.write(data);
    }
})();
