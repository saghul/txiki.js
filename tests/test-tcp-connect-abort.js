import assert from 'tjs:assert';


// Pre-aborted signal: connect must reject immediately with the signal's reason.
async function testAlreadyAborted() {
    const controller = new AbortController();

    controller.abort();

    let errorName = null;

    try {
        await tjs.connect('tcp', '127.0.0.1', 1, { signal: controller.signal });
    } catch (e) {
        errorName = e.name;
    }

    assert.eq(errorName, 'AbortError', 'pre-aborted signal rejects with its reason');
}

// Abort while the connect is in flight: 192.0.2.0/24 (TEST-NET-1) is reserved
// and never routable, so without the abort this connect would hang until the
// kernel TCP timeout.
async function testAbortInFlight() {
    const controller = new AbortController();

    setTimeout(() => controller.abort(), 100);

    const start = Date.now();
    let errorName = null;

    try {
        await tjs.connect('tcp', '192.0.2.1', 81, { signal: controller.signal });
    } catch (e) {
        errorName = e.name;
    }

    assert.eq(errorName, 'AbortError', 'in-flight connect rejects with the abort reason');
    assert.ok(Date.now() - start < 5000, 'rejects promptly, not at the kernel timeout');
}

// A signal that never fires must not interfere with a successful connect.
async function testConnectWithIdleSignal() {
    const server = await tjs.listen('tcp', '127.0.0.1', 0);
    const { localPort } = await server.opened;
    const controller = new AbortController();

    const socket = await tjs.connect('tcp', '127.0.0.1', localPort, { signal: controller.signal });

    assert.ok(socket, 'connect succeeds with an idle signal attached');

    // Aborting after the connect settled is a no-op.
    controller.abort();

    socket.close();
    server.close();
}

// Connect failure with a signal attached: the rejection must surface only
// through the returned promise. A detached rejection from the listener-cleanup
// chain would abort the whole test run as an unhandled rejection.
async function testConnectRefusedWithSignal() {
    // Bind + close to get a port that is known to refuse connections.
    const server = await tjs.listen('tcp', '127.0.0.1', 0);
    const { localPort } = await server.opened;

    server.close();

    const controller = new AbortController();
    let threw = false;

    try {
        await tjs.connect('tcp', '127.0.0.1', localPort, { signal: controller.signal });
    } catch (e) {
        threw = true;
        assert.ok(e.message.includes('ECONNREFUSED'), 'fails with the connect error, not the signal');
    }

    assert.ok(threw, 'refused connect rejects');

    // Give the listener-cleanup microtasks a tick to surface any leak.
    await new Promise(resolve => setTimeout(resolve, 50));
}

await testAlreadyAborted();
await testAbortInFlight();
await testConnectWithIdleSignal();
await testConnectRefusedWithSignal();
