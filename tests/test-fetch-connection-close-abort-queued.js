// A fetch queued on another one's connection, and aborted in the same poll
// batch in which that connection's "Connection: close" response arrives, must
// not be restarted and sent once the queue is broken up: the server must never
// see the aborted path, and every fetch must settle.
//
// The abort is driven from an I/O callback (a read on a signal connection) so
// that it lands inside the poll phase, before the leader's response is read.
// Whether both fds are reported in one batch is up to the kernel, so a single
// attempt can miss the window: loop several. With the fix no attempt can fail.
import assert from 'tjs:assert';

const ATTEMPTS = 10;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function response(body) {
    return `HTTP/1.1 200 OK\r\nConnection: close\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
}

async function readHead(reader) {
    let buf = '';

    while (!buf.includes('\r\n\r\n')) {
        const { value, done } = await reader.read();

        if (done) {
            return null;
        }

        buf += decoder.decode(value, { stream: true });
    }

    return buf;
}

async function attempt(n) {
    const paths = [];
    let connections = 0;
    const leader = Promise.withResolvers();

    const server = await tjs.listen('tcp', '127.0.0.1', 0);
    const { readable: acceptQueue, localPort: port } = await server.opened;

    (async () => {
        const reader = acceptQueue.getReader();

        while (true) {
            let accepted;

            try {
                accepted = await reader.read();
            } catch {
                break;
            }

            if (accepted.done) {
                break;
            }

            const first = ++connections === 1;

            (async conn => {
                const { readable, writable } = await conn.opened;
                const writer = writable.getWriter();
                const head = await readHead(readable.getReader()).catch(() => null);

                if (!head) {
                    return;
                }

                const path = head.split(' ')[1];

                paths.push(path);

                if (first) {
                    // Hold the leader's response until the test sends it.
                    leader.resolve({ conn, writer });
                } else {
                    await writer.write(encoder.encode(response(`${path}-body`))).catch(() => {});
                    conn.close();
                }
            })(accepted.value);
        }
    })();

    const sig = await tjs.listen('tcp', '127.0.0.1', 0);
    const { readable: sigAccept, localPort: sigPort } = await sig.opened;
    const sigConn = await tjs.connect('tcp', '127.0.0.1', sigPort);
    const { readable: sigReadable } = await sigConn.opened;
    const { value: sigSrv } = await sigAccept.getReader().read();
    const sigWriter = (await sigSrv.opened).writable.getWriter();
    const ctrl = new AbortController();

    sigReadable.getReader().read().then(() => ctrl.abort());

    const base = `http://127.0.0.1:${port}`;
    const settle = p => p.then(r => r.text()).then(t => t, e => `ERR ${e.name}`);
    const all = Promise.all([
        settle(fetch(`${base}/a`)),
        settle(fetch(`${base}/b`, { signal: ctrl.signal })),
        settle(fetch(`${base}/c`)),
    ]);

    const { conn: leaderConn, writer: leaderWriter } = await leader.promise;

    // Let /b and /c queue up on /a's connection.
    await new Promise(r => setTimeout(r, 100));

    // The signal byte first, so its fd tends to be serviced first in the batch.
    await sigWriter.write(new Uint8Array([ 1 ]));
    await leaderWriter.write(encoder.encode(response('a-body')));

    let timer;
    const watchdog = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`attempt ${n}: fetches never settled`)), 5000);
    });
    const results = await Promise.race([ all, watchdog ]);

    clearTimeout(timer);

    // Give a wrongly restarted /b the time to reach the server.
    await new Promise(r => setTimeout(r, 200));

    assert.eq(results.join(','), 'a-body,ERR AbortError,/c-body', `attempt ${n}: results`);
    assert.ok(!paths.includes('/b'), `attempt ${n}: the aborted /b was sent (server saw ${paths.join(',')})`);

    leaderConn.close();
    sigConn.close();
    await sig.close();
    await server.close();
}

for (let i = 1; i <= ATTEMPTS; i++) {
    await attempt(i);
}
