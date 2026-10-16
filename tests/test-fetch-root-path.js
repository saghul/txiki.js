// The request line must carry "/" (not "//") for URLs with an empty or bare
// "/" path, while distinct paths such as "//foo" are sent verbatim
// (https://github.com/saghul/txiki.js/issues/1085). A raw TCP server is used
// so the literal request line is visible.
import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const server = await tjs.listen('tcp', '127.0.0.1', 0);
const { readable, localPort: port } = await server.opened;
const pending = [];

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

        handleConnection(accepted.value);
    }
})();

// The server answers with keep-alive rather than "Connection: close": a fetch
// issued right after a close-delimited response can race the dying pooled
// connection, which is unrelated to what this test checks.
async function handleConnection(conn) {
    const { readable, writable } = await conn.opened;
    const reader = readable.getReader();
    const writer = writable.getWriter();
    let buf = '';

    try {
        while (true) {
            const { value, done } = await reader.read();

            if (done) {
                break;
            }

            buf += decoder.decode(value, { stream: true });

            let idx;

            while ((idx = buf.indexOf('\r\n\r\n')) !== -1) {
                const head = buf.slice(0, idx);

                buf = buf.slice(idx + 4);

                const line = head.slice(0, head.indexOf('\r\n'));
                const isWs = /^upgrade:\s*websocket/im.test(head);

                pending.shift()?.resolve(line);

                if (isWs) {
                    return;
                }

                await writer.write(encoder.encode('HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok'));
            }
        }
    } catch {
        // The client may drop the connection first.
    } finally {
        conn.close();
    }
}

function nextRequestLine() {
    const p = Promise.withResolvers();

    pending.push(p);

    return p.promise;
}

function pathOf(line) {
    return line.split(' ')[1];
}

const base = `http://127.0.0.1:${port}`;
const fetchCases = [
    [ base, '/' ],
    [ `${base}/`, '/' ],
    [ `${base}/foo`, '/foo' ],
    [ `${base}//foo`, '//foo' ],
    [ `${base}?x=1`, '/?x=1' ],
    [ `${base}/?x=1`, '/?x=1' ],
];

for (const [ url, expected ] of fetchCases) {
    const line = nextRequestLine();
    const r = await fetch(url);

    assert.eq(await r.text(), 'ok', `fetch ${url} body`);
    assert.eq(pathOf(await line), expected, `fetch ${url} request path`);
}

{
    const line = nextRequestLine();
    const done = Promise.withResolvers();
    const xhr = new XMLHttpRequest();

    xhr.onloadend = () => done.resolve();
    xhr.open('GET', base);
    xhr.send();
    await done.promise;
    assert.eq(pathOf(await line), '/', 'XHR request path');
}

{
    const line = nextRequestLine();
    const closed = Promise.withResolvers();
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);

    ws.onerror = () => {};
    ws.onclose = () => closed.resolve();
    assert.eq(pathOf(await line), '/', 'WebSocket request path');
    await closed.promise;
}

await server.close();
