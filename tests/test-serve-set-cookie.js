import assert from 'tjs:assert';

// A response carrying two Set-Cookie headers must put each on its own line:
// a client can't split a comma-joined Set-Cookie (cookie attributes contain
// commas, e.g. Expires), so it keeps only the first cookie. Checked on the raw
// HTTP/1.1 response for both the buffered and the streaming response path.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function rawGet(port, path) {
    const con = await tjs.connect('tcp', '127.0.0.1', port);
    const { readable, writable } = await con.opened;
    const writer = writable.getWriter();

    await writer.write(encoder.encode(`GET ${path} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`));

    const reader = readable.getReader();
    let data = '';

    for (let r = await reader.read(); !r.done; r = await reader.read()) {
        data += decoder.decode(r.value, { stream: true });
    }

    con.close();

    return data;
}

function headerLines(response, name) {
    return response.split('\r\n\r\n')[0].split('\r\n')
        .filter(line => line.toLowerCase().startsWith(name + ':'))
        .map(line => line.slice(name.length + 1).trim());
}

const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    fetch: req => {
        const headers = new Headers();

        headers.append('Set-Cookie', 'a=1; Path=/');
        headers.append('Set-Cookie', 'b=2; Path=/');
        headers.append('X-Multi', 'x');
        headers.append('X-Multi', 'y');

        if (new URL(req.url).pathname === '/stream') {
            const body = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode('ok'));
                    controller.close();
                },
            });

            return new Response(body, { headers });
        }

        return new Response('ok', { headers });
    },
});

try {
    for (const path of [ '/buffered', '/stream' ]) {
        const response = await rawGet(server.port, path);

        assert.ok(response.startsWith('HTTP/1.1 200'), `${path}: 200 response`);
        assert.eq(headerLines(response, 'set-cookie'), [ 'a=1; Path=/', 'b=2; Path=/' ],
            `${path}: one Set-Cookie line per cookie`);
        assert.eq(headerLines(response, 'x-multi'), [ 'x, y' ], `${path}: other headers still combine`);
    }
} finally {
    await server.close();
}
