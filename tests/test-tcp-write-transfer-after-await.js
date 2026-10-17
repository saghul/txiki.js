import assert from 'tjs:assert';

// Once a TCP write has resolved libuv no longer touches the buffer, so it must
// be transferable from the code right after `await writer.write(buf)`. The pin
// has to be released before the write callback resolves the promise (it drains
// microtasks), whether the write completed inline or asynchronously.

const SIZE = 16 * 1024 * 1024;
const data = new Uint8Array(SIZE);

for (let i = 0; i < 256; i++) {
    data[i] = i;
}

for (let n = 256; n < SIZE; n *= 2) {
    data.copyWithin(n, 0, n);
}

const server = new TCPServerSocket('127.0.0.1', { localPort: 0 });
const { readable: acceptStream, localPort } = await server.opened;
const acceptReader = acceptStream.getReader();
const client = new TCPSocket('127.0.0.1', localPort);
const { writable } = await client.opened;
const { value: conn } = await acceptReader.read();
const { readable } = await conn.opened;

acceptReader.releaseLock();

async function readAll() {
    const reader = readable.getReader();
    let total = 0;

    for (;;) {
        const { value, done } = await reader.read();

        if (done) {
            break;
        }

        total += value.length;
    }

    return total;
}

const received = readAll();
const writer = writable.getWriter();

await writer.write(data);

const clone = structuredClone(data.buffer, { transfer: [ data.buffer ] });

assert.eq(data.buffer.detached, true, 'buffer detached right after the awaited write');
assert.eq(clone.byteLength, SIZE, 'clone has the contents');

await writer.close();

assert.eq(await received, SIZE, 'peer got every byte');

conn.close();
client.close();
server.close();
