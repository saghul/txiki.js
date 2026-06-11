// HTTP CONNECT proxy that REQUIRES Basic proxy authentication, for testing
// authenticated proxy URLs (http_proxy=http://user:pass@host:port).
//
// - Verifies the Proxy-Authorization header carries base64("user:pass") from
//   PROXY_AUTH; on a missing/wrong credential it replies 407 and closes.
// - On success it tunnels to 127.0.0.1:BACKEND_PORT, IGNORING the CONNECT
//   target. The test points the request at a dead port, so it can only
//   succeed if it actually went through this proxy (proving the authenticated
//   proxy was used, not silently dropped).

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const expectedToken = btoa(tjs.env.PROXY_AUTH);   // base64("user:pass")
const backendPort = parseInt(tjs.env.BACKEND_PORT);

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

    const writer = cw.getWriter();

    // Verify the Proxy-Authorization header (scheme is case-insensitive; lws
    // emits a lowercase "basic"). Compare only the base64 token.
    const m = buf.match(/Proxy-Authorization:\s*\S+\s+(\S+)\r\n/i);

    if (!m || m[1].trim() !== expectedToken) {
        await writer.write(encoder.encode('HTTP/1.1 407 Proxy Authentication Required\r\n\r\n'));
        writer.releaseLock();
        conn.close();

        return;
    }

    // Auth OK — tunnel to the real backend (ignoring the CONNECT target).
    let target;

    try {
        target = await tjs.connect('tcp', '127.0.0.1', backendPort);
        await target.opened;
    } catch {
        await writer.write(encoder.encode('HTTP/1.1 502 Bad Gateway\r\n\r\n'));
        writer.releaseLock();
        conn.close();

        return;
    }

    const { readable: tr, writable: tw } = await target.opened;

    await writer.write(encoder.encode('HTTP/1.1 200 Connection Established\r\n\r\n'));
    writer.releaseLock();
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
