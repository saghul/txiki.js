// Shared body of the test-*-gc-pending-write.js tests: a client socket whose
// read pin was dropped (readable cancelled) and which is referenced only from a
// detached async frame awaiting its own pending write must not be collected
// before the write completes.

import assert from 'tjs:assert';
import path from 'tjs:path';
import certPem from '../fixtures/server-cert.pem' with { type: 'text' };
import keyPem from '../fixtures/server-key.pem' with { type: 'text' };

const MiB = 1024 * 1024;
const GC_STRESS = Boolean(tjs.env.TJS_GC_STRESS);

// Larger than the loopback socket buffers on every CI platform (Linux can reach
// several MiB), so the write stays queued until the server starts reading. The
// GC-stress job (Linux only) runs a full GC per allocation, so every read is
// slow there; it uses smaller sizes, still above what Linux buffers while the
// peer isn't reading (AF_UNIX ~200 KiB, TCP 128 KiB rmem + autotuned wmem).
const SIZES = GC_STRESS ? { tcp: 8 * MiB, pipe: 1 * MiB, tls: 4 * MiB } : { tcp: 16 * MiB, pipe: 16 * MiB, tls: 16 * MiB };

// Fail fast (before the runner's 30 s timeout) if the write never settles.
const TIMEOUT = GC_STRESS ? 20000 : 5000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Fail instead of hanging into the runner timeout.
async function withTimeout(promise, what) {
    let timer;
    const expired = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${what} did not settle within ${TIMEOUT} ms`)), TIMEOUT);
    });

    try {
        return await Promise.race([ promise, expired ]);
    } finally {
        clearTimeout(timer);
    }
}

function pipeName() {
    const name = `tjs-gc-pending-write-${tjs.pid}`;

    if (navigator.userAgentData.platform === 'Windows') {
        return `\\\\?\\pipe\\${name}`;
    }

    return path.join(tjs.tmpDir, `${name}.sock`);
}

function makeServer(kind) {
    switch (kind) {
        case 'tcp':
            return new TCPServerSocket('127.0.0.1', { localPort: 0 });
        case 'pipe':
            return new PipeServerSocket(pipeName());
        case 'tls':
            return new TLSServerSocket('127.0.0.1', { localPort: 0, cert: certPem, key: keyPem });
    }

    throw new Error(`unknown kind ${kind}`);
}

function makeClient(kind, sopened) {
    switch (kind) {
        case 'tcp':
            return new TCPSocket('127.0.0.1', sopened.localPort);
        case 'pipe':
            return new PipeSocket(sopened.localAddress);
        case 'tls':
            return new TLSSocket('127.0.0.1', sopened.localPort, { verifyPeer: false });
    }
}

async function sha256(buf) {
    return new Uint8Array(await crypto.subtle.digest('SHA-256', buf)).toString();
}

export async function runPendingWriteGcTest(kind) {
    const SIZE = SIZES[kind];

    // Non-constant content (i & 0xff), filled natively: a per-byte JS loop over
    // SIZE bytes takes many seconds on sanitizer builds.
    const data = new Uint8Array(SIZE);

    for (let i = 0; i < 256; i++) {
        data[i] = i;
    }

    for (let len = 256; len < SIZE; len *= 2) {
        data.copyWithin(len, 0, len);
    }

    const expected = await sha256(data);

    const server = makeServer(kind);
    const sopened = await server.opened;
    const acceptReader = sopened.readable.getReader();

    let settled = false;
    const { promise: clientDone, resolve, reject } = Promise.withResolvers();

    // The client is reachable only from this detached frame.
    (async () => {
        const { readable, writable } = await makeClient(kind, sopened).opened;

        // stopRead: the socket's read pin is released.
        await readable.cancel();

        const writer = writable.getWriter();

        try {
            await writer.write(data);
            settled = true;
            await writer.close();
            resolve();
        } catch (e) {
            settled = true;
            reject(e);
        }
    })();

    const { value: conn } = await acceptReader.read();
    const { readable } = await conn.opened;

    const gcTimer = setInterval(() => tjs.engine.gc.run(), 5);

    // Let the GC run while the client's write is queued behind a peer that
    // isn't reading.
    await sleep(500);

    assert.ok(!settled, 'client write is still pending when the server starts reading');

    const reader = readable.getReader();
    const received = new Uint8Array(SIZE);
    const readAll = (async () => {
        let total = 0;

        for (;;) {
            const { value, done } = await reader.read();

            if (done) {
                return total;
            }

            if (total + value.length > SIZE) {
                assert.fail(`server received more than ${SIZE} bytes`);
            }

            received.set(value, total);
            total += value.length;
        }
    })();

    try {
        await withTimeout(clientDone, 'client write and close');

        const total = await withTimeout(readAll, 'server read to EOF');

        assert.eq(total, SIZE, `server received all ${SIZE} bytes`);
        assert.eq(await sha256(received), expected, 'server received the data intact');
    } finally {
        clearInterval(gcTimer);
        conn.close();
        acceptReader.releaseLock();
        server.close();
    }
}
