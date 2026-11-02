// A streaming fetch whose reader is cancelled on the last chunk of its body,
// with another fetch to the same origin queued behind it: the cancel aborts the
// request from inside lws's read of that chunk, so its close is decided just
// before its transaction completes and lws hands the connection over to the
// queued request. The retired request must then still be closed and freed
// (patches/lws-remove-from-sul-clears-close-decided.patch); without the patch
// lws ignores that close and frees the request only when the runtime exits.
//
// The leak itself can't be seen from JS (it is verified under a debugger), so
// this test pins down the path: both requests go out on one connection, the
// queued one is served, the cancelled one settles, and the retired request's
// close runs (under ASAN, safely) on each attempt.
import assert from 'tjs:assert';

const ATTEMPTS = 5;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function readHead(reader, carry) {
    let buf = carry;

    while (!buf.includes('\r\n\r\n')) {
        const { value, done } = await reader.read();

        if (done) {
            return [ null, '' ];
        }

        buf += decoder.decode(value, { stream: true });
    }

    const idx = buf.indexOf('\r\n\r\n');

    return [ buf.slice(0, idx), buf.slice(idx + 4) ];
}

async function attempt(n) {
    const paths = [];
    let connections = 0;

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

            connections++;

            (async conn => {
                const { readable, writable } = await conn.opened;
                const r = readable.getReader();
                const w = writable.getWriter();
                let carry = '';

                try {
                    while (true) {
                        const [ head, rest ] = await readHead(r, carry);

                        if (head === null) {
                            break;
                        }

                        carry = rest;

                        const path = head.split(' ')[1];

                        paths.push(path);

                        if (path === '/a') {
                            // Keep-alive response whose body arrives in two
                            // parts: the second part completes it.
                            await w.write(encoder.encode(
                                'HTTP/1.1 200 OK\r\nContent-Length: 10\r\n\r\n01234'));
                            await new Promise(res => setTimeout(res, 100));
                            await w.write(encoder.encode('56789'));
                        } else {
                            const body = `${path}-body`;

                            await w.write(encoder.encode(
                                `HTTP/1.1 200 OK\r\nConnection: close\r\nContent-Length: ${body.length}\r\n\r\n${body}`));
                            break;
                        }
                    }
                } catch {
                    // The client went away.
                }

                conn.close();
            })(accepted.value);
        }
    })();

    const base = `http://127.0.0.1:${port}`;

    const a = (async () => {
        const res = await fetch(`${base}/a`);
        const reader = res.body.getReader();
        let got = 0;

        while (true) {
            const { value, done } = await reader.read();

            if (done) {
                break;
            }

            got += value.byteLength;

            if (got >= 10) {
                // Runs in the microtask drained inside lws's read of the
                // final chunk.
                await reader.cancel();
                break;
            }
        }

        return `a:${got}`;
    })().catch(e => `a:ERR ${e.name}`);
    const b = fetch(`${base}/b`).then(r => r.text()).then(t => `b:${t}`, e => `b:ERR ${e.name}`);

    let timer;
    const watchdog = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`attempt ${n}: fetches never settled`)), 5000);
    });
    const results = await Promise.race([ Promise.all([ a, b ]), watchdog ]);

    clearTimeout(timer);

    assert.eq(results.join(','), 'a:10,b:/b-body', `attempt ${n}: results`);
    assert.eq(paths.join(','), '/a,/b', `attempt ${n}: paths`);
    assert.eq(connections, 1, `attempt ${n}: /b was queued on /a's connection`);

    await server.close();
}

for (let i = 1; i <= ATTEMPTS; i++) {
    await attempt(i);
}
