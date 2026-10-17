// Two native requests pin the same buffer: an fs write and a TCP write. The fs
// write completes first; the buffer must stay pinned (immutable) until the TCP
// write is done too, or transfer() would free it under the in-flight write.
import assert from 'tjs:assert';
import path from 'tjs:path';

if (navigator.userAgentData.platform === 'Windows') {
    // A 16 MiB loopback TCP write completes right away on Windows, so the
    // write can't be held in flight (see PR #1160's Windows CI runs).
    tjs.exit(0);
}

// Big enough that the kernel socket buffers can't absorb it while the peer
// isn't reading, so the TCP write stays in flight.
const SIZE = 16 * 1024 * 1024;

async function sha256(buf) {
    return new Uint8Array(await crypto.subtle.digest('SHA-256', buf)).toString();
}

// Content is i & 0xff, filled natively: a per-byte JS loop over SIZE bytes is
// too slow on Debug and sanitizer builds.
const data = new Uint8Array(SIZE);

for (let i = 0; i < 256; i++) {
    data[i] = i;
}

for (let len = 256; len < SIZE; len *= 2) {
    data.copyWithin(len, 0, len);
}

// Hashed before any write starts, so the digest never overlaps the pins.
const expected = await sha256(data);

const server = new TCPServerSocket('127.0.0.1', { localPort: 0 });
const { readable: acceptStream, localPort } = await server.opened;
const acceptReader = acceptStream.getReader();
const client = new TCPSocket('127.0.0.1', localPort);
const { writable } = await client.opened;
const { value: conn } = await acceptReader.read();
const { readable } = await conn.opened;
const writer = writable.getWriter();

const f = await tjs.makeTempFile(path.join(tjs.tmpDir, 'tjs-buf-pin-XXXXXX'));
const fpath = f.path;

const fsWrite = f.write(data);
let tcpDone = false;
const tcpWrite = writer.write(data).then(() => {
    tcpDone = true;
});

await fsWrite;
await f.close();
await tjs.remove(fpath);
await new Promise(resolve => setTimeout(resolve, 100));

assert.ok(!tcpDone, 'precondition: TCP write still in flight');
assert.ok(data.buffer.immutable, 'buffer stays pinned while the TCP write uses it');
assert.throws(() => data.buffer.transfer(), TypeError, 'transfer() rejected while pinned');

const reader = readable.getReader();
const received = new Uint8Array(SIZE);
let total = 0;

const readDone = (async () => {
    for (;;) {
        const { value, done } = await reader.read();

        if (done) {
            break;
        }

        received.set(value, total);
        total += value.length;
    }
})();

await tcpWrite;
await writer.close();
await readDone;

assert.eq(total, SIZE, 'peer got all the data');

assert.eq(await sha256(received), expected, 'peer data intact');

assert.ok(!data.buffer.immutable, 'buffer is mutable once the last pin is released');

const moved = data.buffer.transfer();

assert.eq(moved.byteLength, SIZE);
assert.ok(data.buffer.detached);

conn.close();
client.close();
server.close();
