import assert from 'tjs:assert';
import certPem from './fixtures/server-cert.pem' with { type: 'text' };
import keyPem from './fixtures/server-key.pem' with { type: 'text' };

// A large write is encrypted in 64 KiB chunks, at most 256 KiB per event loop
// iteration. These sizes sit on both sides of those boundaries.
const BOUNDARY_SIZES = [ 65536, 65537, 262144, 262145, 4 * 1024 * 1024 ];
const LATE_READER_SIZE = 8 * 1024 * 1024;
const YIELD_SIZE = 32 * 1024 * 1024;

function makeData(size) {
    const data = new Uint8Array(size);

    for (let i = 0; i < size; i++) {
        data[i] = i & 0xff;
    }

    return data;
}

function assertData(received, size) {
    assert.eq(received.length, size, `received all ${size} bytes`);

    for (let i = 0; i < size; i++) {
        if (received[i] !== (i & 0xff)) {
            assert.fail(`byte ${i} of ${size} is ${received[i]}, expected ${i & 0xff}`);
        }
    }
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

    assertData(await received, size);

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
