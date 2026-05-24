import assert from 'tjs:assert';


// `await using` on a Worker terminates the underlying thread when the
// scope ends, even when the worker is still running.

const workerSource = `
    addEventListener('message', e => {
        postMessage(e.data);
    });
    // Keep the worker event loop alive indefinitely.
    setInterval(() => {}, 60_000);
`;

function makeWorkerUrl() {
    const blob = new Blob([ workerSource ], { type: 'text/javascript' });

    return URL.createObjectURL(blob);
}

// Round-trip a message in scope, verify Worker exits when the scope ends.
{
    const url = makeWorkerUrl();
    const { promise: gotEcho, resolve: echoResolve } = Promise.withResolvers();

    {
        await using w = new Worker(url);

        w.onmessage = e => echoResolve(e.data);
        w.postMessage('hello');

        const reply = await gotEcho;

        assert.eq(reply, 'hello', 'worker echoed message');
    }

    URL.revokeObjectURL(url);
}

// The await using above implicitly proves the worker thread is joined
// (otherwise the runtime would still have an outstanding worker thread
// holding refs).  Loop a few times to make sure repeated dispose works.
{
    for (let i = 0; i < 3; i++) {
        const url = makeWorkerUrl();

        {
            await using w = new Worker(url);

            assert.ok(w);
        }

        URL.revokeObjectURL(url);
    }
}

// Idempotency: manual terminate() then disposer is safe.
{
    const url = makeWorkerUrl();
    const w = new Worker(url);

    w.terminate();
    w[Symbol.dispose]();

    URL.revokeObjectURL(url);
}
