import assert from 'tjs:assert';

// MessageEvent spec constructor and fields.

assert.eq(typeof MessageEvent, 'function', 'MessageEvent is a global');

const plain = new MessageEvent('message');
assert.eq(plain.data, null, 'data defaults to null');
assert.eq(plain.origin, '', 'origin defaults to empty string');
assert.eq(plain.lastEventId, '', 'lastEventId defaults to empty string');
assert.eq(plain.source, null, 'source defaults to null');
assert.ok(Array.isArray(plain.ports), 'ports is an array');
assert.eq(plain.ports.length, 0, 'ports defaults to empty');

const { port1, port2 } = new MessageChannel();

const ev = new MessageEvent('message', {
    data: { hello: 'world' },
    origin: 'https://example.com',
    lastEventId: '42',
    ports: [ port1, port2 ]
});

assert.eq(ev.data.hello, 'world', 'data set from init');
assert.eq(ev.origin, 'https://example.com', 'origin set from init');
assert.eq(ev.lastEventId, '42', 'lastEventId set from init');
assert.eq(ev.ports.length, 2, 'ports set from init');
assert.ok(ev instanceof Event, 'MessageEvent extends Event');

port1.close();
port2.close();
