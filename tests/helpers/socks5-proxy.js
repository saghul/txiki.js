// Minimal SOCKS5 proxy (RFC 1928, no auth, CONNECT only) for tests.
// Prints the listening port on stdout, then tunnels each CONNECT to its target.

const server = await tjs.listen('tcp', '127.0.0.1', 0);
const { readable, localPort } = await server.opened;

console.log(String(localPort));

const acceptReader = readable.getReader();

// Read exactly `n` bytes from a reader, buffering across chunks.
async function readN(reader, pending, n) {
    while (pending.length < n) {
        const { value, done } = await reader.read();

        if (done) {
            return null;
        }

        const merged = new Uint8Array(pending.length + value.length);

        merged.set(pending);
        merged.set(value, pending.length);
        pending = merged;
    }

    return { chunk: pending.slice(0, n), rest: pending.slice(n) };
}

function pump(reader, writer) {
    return (async () => {
        try {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const { value, done } = await reader.read();

                if (done) {
                    break;
                }

                await writer.write(value);
            }
        } catch {
            // Peer closed.
        } finally {
            try {
                await writer.close();
            } catch { /* already closed */ }
        }
    })();
}

async function handleClient(conn) {
    const { readable: cr, writable: cw } = await conn.opened;
    const reader = cr.getReader();
    let pending = new Uint8Array(0);

    // Greeting: VER, NMETHODS, METHODS...
    let r = await readN(reader, pending, 2);

    if (!r) {
        conn.close();

        return;
    }

    const nmethods = r.chunk[1];

    pending = r.rest;
    r = await readN(reader, pending, nmethods);

    if (!r) {
        conn.close();

        return;
    }

    pending = r.rest;

    // Reply: no authentication required.
    const writer = cw.getWriter();

    await writer.write(new Uint8Array([ 0x05, 0x00 ]));

    // Request: VER, CMD, RSV, ATYP, ...
    r = await readN(reader, pending, 4);

    if (!r) {
        conn.close();

        return;
    }

    const atyp = r.chunk[3];

    pending = r.rest;

    let host;

    if (atyp === 0x01) {
        r = await readN(reader, pending, 4);
        host = Array.from(r.chunk).join('.');
        pending = r.rest;
    } else if (atyp === 0x03) {
        r = await readN(reader, pending, 1);
        const len = r.chunk[0];

        pending = r.rest;
        r = await readN(reader, pending, len);
        host = new TextDecoder().decode(r.chunk);
        pending = r.rest;
    } else {
        // IPv6 unsupported in this test helper.
        conn.close();

        return;
    }

    r = await readN(reader, pending, 2);
    const port = (r.chunk[0] << 8) | r.chunk[1];

    pending = r.rest;

    // Connect to the target and reply success.
    let target;

    try {
        target = await tjs.connect('tcp', host, port);
    } catch {
        await writer.write(new Uint8Array([ 0x05, 0x01, 0x00, 0x01, 0, 0, 0, 0, 0, 0 ]));
        writer.releaseLock();
        conn.close();

        return;
    }

    await writer.write(new Uint8Array([ 0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0 ]));
    writer.releaseLock();

    const { readable: tr, writable: tw } = await target.opened;

    // Forward any bytes already buffered after the request, then splice both ways.
    const targetWriter = tw.getWriter();

    if (pending.length) {
        await targetWriter.write(pending);
    }

    targetWriter.releaseLock();

    reader.releaseLock();

    await Promise.allSettled([ pump(cr.getReader(), tw.getWriter()), pump(tr.getReader(), cw.getWriter()) ]);

    conn.close();
    target.close();
}

// eslint-disable-next-line no-constant-condition
while (true) {
    const { value: conn, done } = await acceptReader.read();

    if (done) {
        break;
    }

    void handleClient(conn);
}
