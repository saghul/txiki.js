import assert from 'tjs:assert';
import certPem from './fixtures/server-cert.pem' with { type: 'text' };
import keyPem from './fixtures/server-key.pem' with { type: 'text' };

// A TLS record carries at most 16384 bytes of plaintext, so every size here
// needs more than one mbedtls_ssl_write() call.
const SHUTDOWN_SIZES = [ 16384, 65536, 1024 * 1024 ];

// Large enough that the encrypted output can't all go out with uv_try_write(),
// so the write only completes once the queued uv_write() finishes. If the
// write resolved early, close() would cancel the queued data.
const CLOSE_SIZE = (tjs.env.TJS_GC_STRESS ? 1 : 4) * 1024 * 1024;

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

async function readAll(readable) {
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

async function transfer(size, mode) {
    const client = new TLSSocket('127.0.0.1', localPort, { verifyPeer: false });
    const { writable } = await client.opened;

    const { value: conn } = await acceptReader.read();
    const { readable } = await conn.opened;
    const received = readAll(readable);

    const writer = writable.getWriter();

    await writer.write(makeData(size));

    if (mode === 'close') {
        client.close();
    } else {
        await writer.close();
    }

    assertData(await received, size);

    conn.close();

    if (mode !== 'close') {
        client.close();
    }
}

for (const size of SHUTDOWN_SIZES) {
    await transfer(size, 'shutdown');
}

await transfer(CLOSE_SIZE, 'close');

acceptReader.releaseLock();
server.close();
