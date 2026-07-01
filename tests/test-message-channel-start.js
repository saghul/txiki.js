import assert from 'tjs:assert';

// Port message queue: messages posted before the port is started are buffered
// and flushed on start(); addEventListener alone does not start the port, but
// setting onmessage does.

// 1. Buffering + explicit start().
{
    const { port1, port2 } = new MessageChannel();

    port1.postMessage('a');
    port1.postMessage('b');

    const got = [];

    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 3000);

        port2.addEventListener('message', e => {
            got.push(e.data);

            if (got.length === 2) {
                clearTimeout(timer);
                resolve();
            }
        });

        // addEventListener does not enable delivery on its own.
        port2.start();
    });

    assert.eq(got.join(','), 'a,b', 'buffered messages flushed in order after start()');

    port1.close();
    port2.close();
}

// 2. addEventListener without start() does NOT deliver.
{
    const { port1, port2 } = new MessageChannel();
    let delivered = false;

    port2.addEventListener('message', () => {
        delivered = true;
    });
    port1.postMessage('should-not-arrive-yet');

    await new Promise(resolve => setTimeout(resolve, 100));

    assert.ok(!delivered, 'no delivery without start()');

    port1.close();
    port2.close();
}

// 3. Setting onmessage implicitly starts the port.
{
    const { port1, port2 } = new MessageChannel();

    port1.postMessage('via-onmessage');

    const data = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 3000);

        port2.onmessage = e => {
            clearTimeout(timer);
            resolve(e.data);
        };
    });

    assert.eq(data, 'via-onmessage', 'setting onmessage flushed the buffered message');

    port1.close();
    port2.close();
}
