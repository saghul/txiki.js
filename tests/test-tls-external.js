import assert from 'tjs:assert';

const client = new TLSSocket('1.1.1.1', 443, {
    sni: 'one.one.one.one',
});

const { readable, writable, remotePort } = await client.opened;
assert.eq(remotePort, 443, 'remote port is 443');
client.close();
