import assert from 'tjs:assert';

import { subnetBroadcast } from './helpers/udp-broadcast.js';

const addr = subnetBroadcast();

if (!addr) {
    console.log('Skipping test: no non-internal IPv4 interface');
} else {
    const sock = new UDPSocket({ localAddress: '0.0.0.0', broadcast: true });
    const { writable } = await sock.opened;
    const writer = writable.getWriter();

    await writer.write({ data: new Uint8Array([ 1 ]), remoteAddress: addr, remotePort: 9 });

    // A failed send errors the stream rather than rejecting its own write,
    // so the follow-up write is what proves the broadcast send went through.
    await writer.write({ data: new Uint8Array([ 1 ]), remoteAddress: '127.0.0.1', remotePort: 9 });
    assert.ok(writer.desiredSize !== null, 'stream is not errored');

    sock.close();
}
