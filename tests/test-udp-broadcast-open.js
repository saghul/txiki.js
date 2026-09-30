import assert from 'tjs:assert';

const sock = new UDPSocket({ localAddress: '0.0.0.0', broadcast: true });
const info = await sock.opened;

assert.eq(info.localAddress, '0.0.0.0', 'socket bound');
assert.ok(info.localPort > 0, 'got a local port');

sock.close();

const connected = new UDPSocket({ remoteAddress: '127.0.0.1', remotePort: 9, broadcast: true });

await connected.opened;
connected.close();
