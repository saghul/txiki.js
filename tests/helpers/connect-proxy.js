// Minimal HTTP CONNECT proxy for testing.
// Reads PROXY_PORT from env, starts a TCP server on that port,
// handles CONNECT requests by tunneling to the target.

const decoder = new TextDecoder();

const server = await tjs.listen('tcp', '127.0.0.1', 0);
const { readable, localPort } = await server.opened;

// Signal the port to the parent on stdout.
console.log(String(localPort));

const acceptReader = readable.getReader();

async function handleClient(conn) {
    const { readable: cr, writable: cw } = await conn.opened;
    const reader = cr.getReader();

    // Read the CONNECT request line + headers.
    let buf = '';

    while (true) {
        const { value, done } = await reader.read();

        if (done) {
            return;
        }

        buf += decoder.decode(value);

        if (buf.includes('\r\n\r\n')) {
            break;
        }
    }

    // Parse "CONNECT host:port HTTP/1.1"
    const match = buf.match(/^CONNECT\s+([^:\s]+):(\d+)\s+HTTP/);

    if (!match) {
        conn.close();

        return;
    }

    const targetHost = match[1];
    const targetPort = parseInt(match[2]);

    // Connect to the target.
    let target;

    try {
        target = await tjs.connect('tcp', targetHost, targetPort);
        await target.opened;
    } catch {
        const writer = cw.getWriter();

        await writer.write(new TextEncoder().encode('HTTP/1.1 502 Bad Gateway\r\n\r\n'));
        writer.releaseLock();
        conn.close();

        return;
    }

    const { readable: tr, writable: tw } = await target.opened;

    // Send 200 to the client.
    const clientWriter = cw.getWriter();

    await clientWriter.write(new TextEncoder().encode('HTTP/1.1 200 Connection Established\r\n\r\n'));
    clientWriter.releaseLock();
    reader.releaseLock();

    // Tunnel data in both directions.
    async function pipe(from, to) {
        const r = from.getReader();
        const w = to.getWriter();

        try {
            while (true) {
                const { value, done } = await r.read();

                if (done) {
                    break;
                }

                await w.write(value);
            }
        } catch {
            // Connection closed.
        } finally {
            r.releaseLock();
            w.releaseLock();
        }
    }

    await Promise.allSettled([
        pipe(cr, tw),
        pipe(tr, cw),
    ]);

    target.close();
    conn.close();
}

// Accept connections in a loop.
try {
    while (true) {
        const { value: conn, done } = await acceptReader.read();

        if (done) {
            break;
        }

        handleClient(conn);
    }
} catch {
    // Server closed.
}
