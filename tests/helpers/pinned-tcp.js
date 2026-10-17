// Shared setup for the tests that transfer a buffer while a TCP write still
// holds it (test-message-channel-transfer-pinned*.js).

// Big enough that the kernel socket buffers can't absorb it while the peer
// isn't reading, so the write stays in flight and keeps the buffer pinned.
export const SIZE = 16 * 1024 * 1024;

export function makeData() {
    const data = new Uint8Array(SIZE);

    for (let i = 0; i < 256; i++) {
        data[i] = i;
    }

    for (let n = 256; n < SIZE; n *= 2) {
        data.copyWithin(n, 0, n);
    }

    return data;
}

export function firstBadByte(buf) {
    for (let i = 0; i < buf.length; i++) {
        if (buf[i] !== (i & 0xff)) {
            return i;
        }
    }

    return -1;
}

export async function connectedPair() {
    const server = new TCPServerSocket('127.0.0.1', { localPort: 0 });
    const { readable: acceptStream, localPort } = await server.opened;
    const acceptReader = acceptStream.getReader();
    const client = new TCPSocket('127.0.0.1', localPort);
    const { writable } = await client.opened;
    const { value: conn } = await acceptReader.read();
    const { readable } = await conn.opened;

    acceptReader.releaseLock();

    return {
        writer: writable.getWriter(),
        readable,
        close() {
            conn.close();
            client.close();
            server.close();
        }
    };
}

export async function readAll(readable) {
    const reader = readable.getReader();
    const out = new Uint8Array(SIZE);
    let total = 0;

    for (;;) {
        const { value, done } = await reader.read();

        if (done) {
            break;
        }

        out.set(value, total);
        total += value.length;
    }

    reader.releaseLock();

    return out.subarray(0, total);
}
