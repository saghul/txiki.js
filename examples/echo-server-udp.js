// Sample UDP echo server.
//

import { addr } from './utils.js';


const u = await tjs.listen('udp', tjs.args[2] || '127.0.0.1', tjs.args[3] || 1234);

console.log(`Listening on ${addr(u.localAddress)}`);

const decoder = new TextDecoder();
const reader = u.readable.getReader();
while (true) {
    const { value: msg, done } = await reader.read();
    if (done) {
        break;
    }
    await u.send(msg.data, msg.addr);
    if (decoder.decode(msg.data) === 'quit\n') {
        break;
    }
}

u.close();

console.log('END');
