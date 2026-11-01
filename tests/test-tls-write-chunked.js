import assert from 'tjs:assert';
import certPem from './fixtures/server-cert.pem' with { type: 'text' };
import keyPem from './fixtures/server-key.pem' with { type: 'text' };

// A large write is encrypted in 64 KiB chunks, at most 256 KiB per event loop
// iteration. These sizes sit on both sides of those boundaries. GC stress
// builds are too slow for the multi-megabyte sizes; 1 MiB still spans several
// iterations.
const BIG = (tjs.env.TJS_GC_STRESS ? 1 : 4) * 1024 * 1024;
const BOUNDARY_SIZES = [ 65536, 65537, 262144, 262145, BIG ];
const LATE_READER_SIZE = 2 * BIG;
const YIELD_SIZE = 8 * 1024 * 1024;

// Per-byte JS loops over these sizes are too slow on Debug builds, so the fill
// doubles a 256-byte prefix (i & 0xff has period 256) and the check compares
// SHA-256 digests.
function makeData(size) {
    const data = new Uint8Array(size);
    const n = Math.min(size, 256);

    for (let i = 0; i < n; i++) {
        data[i] = i;
    }

    for (let filled = n; filled < size; filled *= 2) {
        data.set(data.subarray(0, Math.min(filled, size - filled)), filled);
    }

    return data;
}

async function sha256(data) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));

    return Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
}

async function assertData(received, expected) {
    assert.eq(received.length, expected.length, `received all ${expected.length} bytes`);
    assert.eq(await sha256(received), await sha256(expected), 'received bytes match');
}

async function readAll(readable, startDelay = 0) {
    if (startDelay) {
        await new Promise(resolve => setTimeout(resolve, startDelay));
    }

    const reader = readable.getReader();
    const chunks = [];
    let total = 0;

    for (;;) {
        const { value, done } = await reader.read();

        if (done) {
            break;
        }

        chunks.push(value);
        total += value.length;
    }

    reader.releaseLock();

    const result = new Uint8Array(total);
    let offset = 0;

    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return result;
}

const server = new TLSServerSocket('127.0.0.1', {
    localPort: 0,
    cert: certPem,
    key: keyPem,
});

const { readable: acceptStream, localPort } = await server.opened;
const acceptReader = acceptStream.getReader();

async function transfer(size, { readDelay = 0 } = {}) {
    const client = new TLSSocket('127.0.0.1', localPort, { verifyPeer: false });
    const { writable } = await client.opened;

    const { value: conn } = await acceptReader.read();
    const { readable } = await conn.opened;
    const received = readAll(readable, readDelay);

    const writer = writable.getWriter();
    const data = makeData(size);

    const t0 = performance.now();
    const p = writer.write(data);
    const t1 = performance.now();

    await p;

    const t2 = performance.now();

    await writer.close();

    await assertData(await received, data);

    conn.close();
    client.close();

    return { sync: t1 - t0, total: t2 - t0 };
}

for (const size of BOUNDARY_SIZES) {
    await transfer(size);
}

// The server only starts reading after the client has filled the socket
// buffers, so the write has to wait for the kernel between chunks.
await transfer(LATE_READER_SIZE, { readDelay: 200 });

// Encryption is spread over loop iterations, so write() itself returns quickly.
if (!tjs.env.TJS_GC_STRESS) {
    const { sync, total } = await transfer(YIELD_SIZE);

    assert.ok(sync < total / 4, `write() took ${sync.toFixed(1)} ms of ${total.toFixed(1)} ms`);
}

acceptReader.releaseLock();
server.close();
