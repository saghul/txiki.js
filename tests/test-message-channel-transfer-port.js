import assert from 'tjs:assert';

// A MessagePort can be transferred through another MessagePort and used on the
// receiving side (arriving via MessageEvent.ports).

const outer = new MessageChannel();
const inner = new MessageChannel();

let receivedPort;

const innerData = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 3000);

    outer.port2.onmessage = e => {
        assert.eq(e.ports.length, 1, 'one port transferred');
        assert.ok(e.ports[0] instanceof MessagePort, 'transferred value is a MessagePort');

        receivedPort = e.ports[0];

        receivedPort.onmessage = ev => {
            clearTimeout(timer);
            resolve(ev.data);
        };
    };

    // Transfer inner.port2 across the outer channel, keep inner.port1.
    outer.port1.postMessage('take a port', [ inner.port2 ]);
    inner.port1.postMessage('hello over transferred port');
});

assert.eq(innerData, 'hello over transferred port', 'transferred port carries messages');

// The transferred port is neutered on the sending side.
assert.throws(() => inner.port2.postMessage('x'), Error, 'transferred port is detached');

// A port cannot be transferred through itself.
assert.throws(() => outer.port1.postMessage('x', [ outer.port1 ]), Error, 'cannot transfer source port');

outer.port1.close();
outer.port2.close();
inner.port1.close();
receivedPort.close();
