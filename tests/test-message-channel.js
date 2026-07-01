import assert from 'tjs:assert';

// Basic MessageChannel / MessagePort shape and bidirectional delivery.

const mc = new MessageChannel();

assert.ok(mc.port1 instanceof MessagePort, 'port1 is a MessagePort');
assert.ok(mc.port2 instanceof MessagePort, 'port2 is a MessagePort');
assert.eq(Object.prototype.toString.call(mc), '[object MessageChannel]', 'MessageChannel tag');
assert.eq(Object.prototype.toString.call(mc.port1), '[object MessagePort]', 'MessagePort tag');
assert.throws(() => new MessagePort(), TypeError, 'MessagePort is not constructible');

const { port1, port2 } = mc;
const seen = [];

await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 3000);

    port2.onmessage = e => {
        seen.push('p2:' + e.data);

        if (e.data === 'ping') {
            port2.postMessage('pong');
        }
    };
    port1.onmessage = e => {
        seen.push('p1:' + e.data);
        clearTimeout(timer);
        resolve();
    };

    port1.postMessage('ping');
});

assert.eq(seen.join(','), 'p2:ping,p1:pong', 'bidirectional delivery');

port1.close();
port2.close();
