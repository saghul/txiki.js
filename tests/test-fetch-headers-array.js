// Headers given to fetch() as [[name, value], ...] pairs must go out as those
// headers, not as the array's own properties ("0: x-a,1", "length: 2"). A raw
// TCP server is used so the literal request head is visible.
import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const server = await tjs.listen('tcp', '127.0.0.1', 0);
const { readable, localPort: port } = await server.opened;
const head = Promise.withResolvers();

(async () => {
    const { value: conn } = await readable.getReader().read();
    const { readable: connReadable, writable } = await conn.opened;
    const reader = connReadable.getReader();
    let buf = '';

    while (!buf.includes('\r\n\r\n')) {
        const { value, done } = await reader.read();

        if (done) {
            break;
        }

        buf += decoder.decode(value, { stream: true });
    }

    head.resolve(buf.slice(0, buf.indexOf('\r\n\r\n')));
    await writable.getWriter().write(encoder.encode('HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok'));
    conn.close();
})();

const r = await fetch(`http://127.0.0.1:${port}/`, {
    headers: [ [ 'X-A', '1' ], [ 'x-b', '2' ], [ 'x-b', '3' ] ],
});

assert.eq(await r.text(), 'ok', 'body');

const lines = (await head.promise).split('\r\n').slice(1).map(l => l.toLowerCase());

assert.ok(lines.includes('x-a: 1'), 'x-a sent');
assert.ok(lines.includes('x-b: 2, 3'), 'repeated x-b combined');
assert.ok(!lines.some(l => /^(0|1|2|length):/.test(l)), 'no array properties sent as headers');

await server.close();
