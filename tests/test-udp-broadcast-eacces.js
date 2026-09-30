import assert from 'tjs:assert';

import { subnetBroadcast } from './helpers/udp-broadcast.js';

const addr = subnetBroadcast();

if (navigator.userAgentData.platform === 'Windows') {
    console.log('Skipping test on Windows');
} else if (!addr) {
    console.log('Skipping test: no non-internal IPv4 interface');
} else {
    const sock = new UDPSocket({ localAddress: '0.0.0.0' });
    const { writable } = await sock.opened;
    const writer = writable.getWriter();

    await writer.write({ data: new Uint8Array([ 1 ]), remoteAddress: addr, remotePort: 9 });

    // A failed send errors the stream rather than rejecting its own write.
    const err = await writer.closed.then(() => null, e => e);

    assert.ok(err, 'send without broadcast fails');
    assert.eq(err.code, 'EACCES', 'fails with EACCES');

    sock.close();
}
