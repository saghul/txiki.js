// Plain TCP proxy for a single TLS connection. It forwards the ClientHello
// right away, then holds client->server bytes for a moment and sends them in a
// single write, so the client's Finished and its first application records
// reach the server in the same TCP read. Server->client bytes pass through.
//
// With `endAfterFlush`, the proxy half-closes the upstream connection right
// after that coalesced write, so the server sees the FIN while the application
// data is still buffered.
//
// `onFlush`, if given, is called synchronously right before the coalesced write.

const HOLD_MS = 100;

function concat(chunks) {
    const out = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
    let off = 0;

    for (const c of chunks) {
        out.set(c, off);
        off += c.byteLength;
    }

    return out;
}

async function pipeServerToClient(upstream, downstream) {
    const reader = upstream.readable.getReader();
    const writer = downstream.writable.getWriter();

    try {
        for (;;) {
            const { value, done } = await reader.read();

            if (done) {
                break;
            }

            await writer.write(value);
        }

        await writer.close();
    } catch {
        // The client side went away first.
    }
}

async function pipeClientToServer(downstream, upstream, endAfterFlush, onFlush) {
    const reader = downstream.readable.getReader();
    const writer = upstream.writable.getWriter();
    const held = [];
    let holding = false;
    let flushed;

    try {
        const { value: clientHello, done } = await reader.read();

        if (done) {
            return;
        }

        await writer.write(clientHello);

        for (;;) {
            const { value, done } = await reader.read();

            if (done) {
                break;
            }

            if (holding) {
                held.push(value);
                continue;
            }

            if (flushed) {
                await flushed;

                if (!endAfterFlush) {
                    await writer.write(value);
                }

                continue;
            }

            holding = true;
            held.push(value);
            flushed = new Promise(resolve => setTimeout(resolve, HOLD_MS)).then(async () => {
                holding = false;
                onFlush?.();
                await writer.write(concat(held));

                if (endAfterFlush) {
                    await writer.close();
                }
            });
        }

        await flushed;

        if (!endAfterFlush) {
            await writer.close();
        }
    } catch {
        // Either side went away.
    }
}

export async function createCoalescingProxy(targetPort, { endAfterFlush = false, onFlush } = {}) {
    const server = await tjs.listen('tcp', '127.0.0.1', 0);
    const { readable, localPort } = await server.opened;
    const sockets = [];

    const done = (async () => {
        const acceptReader = readable.getReader();
        const { value: client } = await acceptReader.read();

        acceptReader.releaseLock();

        if (!client) {
            return;
        }

        const upstream = await tjs.connect('tcp', '127.0.0.1', targetPort);

        sockets.push(client, upstream);

        const [ downstream, up ] = await Promise.all([ client.opened, upstream.opened ]);

        await Promise.all([
            pipeServerToClient(up, downstream),
            pipeClientToServer(downstream, up, endAfterFlush, onFlush),
        ]);
    })();

    return {
        port: localPort,
        done,
        close() {
            for (const s of sockets) {
                s.close();
            }

            server.close();
        },
    };
}
