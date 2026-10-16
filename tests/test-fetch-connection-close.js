// A fetch made right after a response on a connection that is closing must
// open its own connection instead of being queued on the dying one. The
// follow-up fetch runs from the first one's completion (microtasks are drained
// synchronously), before the client can have seen the server's FIN, so lws
// must decide from the exchange itself that the connection won't be reused:
// either the response said "Connection: close", or the request did (a
// streaming-body request is never pipelined, so lws sends "connection: close").
import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Raw HTTP/1.1 server that answers exactly one request per connection with
// `respond(path)` and then closes the connection.
async function startServer(respond) {
    const server = await tjs.listen('tcp', '127.0.0.1', 0);
    const { readable, localPort } = await server.opened;
    const state = { connections: 0, requests: [] };

    (async () => {
        const reader = readable.getReader();

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

            handleConnection(accepted.value, state.connections++, state, respond);
        }
    })();

    return { server, base: `http://127.0.0.1:${localPort}`, state };
}

function bodyComplete(head, rest) {
    const lower = head.toLowerCase();
    const cl = /\r\ncontent-length:\s*(\d+)/.exec(lower);

    if (cl) {
        return encoder.encode(rest).length >= Number(cl[1]);
    }

    if (/\r\ntransfer-encoding:\s*chunked/.test(lower)) {
        return rest.includes('0\r\n\r\n');
    }

    return true;
}

async function handleConnection(conn, connId, state, respond) {
    const { readable, writable } = await conn.opened;
    const reader = readable.getReader();
    const writer = writable.getWriter();
    let buf = '';

    try {
        while (true) {
            const { value, done } = await reader.read();

            if (done) {
                return;
            }

            buf += decoder.decode(value, { stream: true });

            const idx = buf.indexOf('\r\n\r\n');

            if (idx !== -1 && bodyComplete(buf.slice(0, idx), buf.slice(idx + 4))) {
                const head = buf.slice(0, idx);
                const [ method, path ] = head.split(' ');

                state.requests.push({ connId, method, path });
                await writer.write(encoder.encode(respond(path)));
                break;
            }
        }
    } catch {
        // The client went away; nothing to do.
    }

    conn.close();
}

// a. Content-Length + Connection: close, three back-to-back fetches.
{
    const { server, base, state } = await startServer(path => {
        const body = `ok ${path}`;

        return 'HTTP/1.1 200 OK\r\n' +
            `Content-Length: ${body.length}\r\n` +
            'Connection: close\r\n\r\n' +
            body;
    });

    for (const p of [ '/a', '/b', '/c' ]) {
        const r = await fetch(base + p);

        assert.eq(r.status, 200, `${p} status is 200`);
        assert.eq(await r.text(), `ok ${p}`, `${p} body`);
    }

    assert.eq(state.requests.map(r => r.path).join(','), '/a,/b,/c', 'server saw every request');
    assert.eq(state.connections, 3, `each request had its own connection (accepted ${state.connections})`);

    await server.close();
}

// b. Close-delimited response (no Content-Length), then a fetch right after.
{
    const { server, base, state } = await startServer(path => {
        return 'HTTP/1.1 200 OK\r\n' +
            'Content-Type: text/plain\r\n' +
            'Connection: close\r\n\r\n' +
            `ok ${path}`;
    });

    const r1 = await fetch(base + '/first');

    assert.eq(await r1.text(), 'ok /first', 'close-delimited body');

    const r2 = await fetch(base + '/second');

    assert.eq(await r2.text(), 'ok /second', 'fetch after a close-delimited response');
    assert.eq(state.connections, 2, `two connections (accepted ${state.connections})`);

    await server.close();
}

// c. Streaming-body POST answered without a Connection header, then a GET.
{
    const { server, base, state } = await startServer(path => {
        const body = `ok ${path}`;

        return 'HTTP/1.1 200 OK\r\n' +
            `Content-Length: ${body.length}\r\n\r\n` +
            body;
    });

    const body = new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode('hello'));
            controller.close();
        },
    });
    const r1 = await fetch(base + '/post', { method: 'POST', body, duplex: 'half' });

    assert.eq(await r1.text(), 'ok /post', 'streaming POST body');

    const r2 = await fetch(base + '/get');

    assert.eq(await r2.text(), 'ok /get', 'GET right after a streaming POST');
    assert.eq(state.requests.map(r => `${r.method} ${r.path}@${r.connId}`).join(','),
        'POST /post@0,GET /get@1', 'GET went out on a new connection');

    await server.close();
}
