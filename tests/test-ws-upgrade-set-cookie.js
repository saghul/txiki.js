import assert from 'tjs:assert';

// server.upgrade() with a Headers instance carrying two Set-Cookie headers must
// send each on its own line in the 101 response.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    fetch(req, { server }) {
        const headers = new Headers();

        headers.append('Set-Cookie', 'a=1; Path=/');
        headers.append('Set-Cookie', 'b=2; Path=/');

        if (server.upgrade(req, { headers })) {
            return;
        }

        return new Response('not ws', { status: 400 });
    },
    websocket: {
        message() {},
    },
});

try {
    const con = await tjs.connect('tcp', '127.0.0.1', server.port);
    const { readable, writable } = await con.opened;
    const writer = writable.getWriter();

    await writer.write(encoder.encode(
        'GET / HTTP/1.1\r\n' +
        'Host: 127.0.0.1\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
        'Sec-WebSocket-Version: 13\r\n' +
        '\r\n'));

    const reader = readable.getReader();
    let data = '';

    while (!data.includes('\r\n\r\n')) {
        const { value, done } = await reader.read();

        assert.ok(!done, 'connection stays open until the 101 head is read');
        data += decoder.decode(value, { stream: true });
    }

    con.close();

    const lines = data.split('\r\n\r\n')[0].split('\r\n');
    const cookies = lines
        .filter(line => line.toLowerCase().startsWith('set-cookie:'))
        .map(line => line.slice('set-cookie:'.length).trim());

    assert.ok(lines[0].startsWith('HTTP/1.1 101'), '101 Switching Protocols');
    assert.eq(cookies, [ 'a=1; Path=/', 'b=2; Path=/' ], 'one Set-Cookie line per cookie');
} finally {
    await server.close();
}
