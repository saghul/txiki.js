// Echo server module for use with `tjs serve`.
// Provides /get, /post, /delay/:s, /bytes/:n, /gzip, /deflate,
// /redirect, /redirect-target, /response-headers, /cookies,
// /image.jpg, /lodash.js, and WebSocket echo.

async function compressData(data, format) {
    const cs = new CompressionStream(format);
    const writer = cs.writable.getWriter();

    writer.write(new TextEncoder().encode(data));
    writer.close();

    const reader = cs.readable.getReader();
    const chunks = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        chunks.push(value);
    }

    const totalLen = chunks.reduce((acc, c) => acc + c.byteLength, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;

    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return result;
}

const LODASH_MOCK = `(function() {
    var _ = {
        first: function(arr) { return arr[0]; },
        last: function(arr) { return arr[arr.length - 1]; },
        VERSION: '4.17.15'
    };
    globalThis._ = _;
})();
`;

const JPEG_DATA = new Uint8Array([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x7B,
    0x40, 0x1B, 0xFF, 0xD9,
]);

// The port is injected by tjs.serve and available via globalThis.__tjsServePort
// We use a placeholder that gets replaced at request time.
let serverPort = 0;

export default {
    fetch: async (req, { server: srv }) => {
        if (!serverPort) {
            // Extract port from the Host header.
            const host = req.headers.get('host') || '';
            const m = host.match(/:(\d+)$/);

            if (m) {
                serverPort = m[1];
            }
        }

        const url = new URL(req.url);

        // WebSocket upgrade.
        if (req.headers.get('upgrade') === 'websocket') {
            const requested = req.headers.get('sec-websocket-protocol');
            const opts = {};

            if (requested) {
                const protocols = requested.split(',').map(p => p.trim());

                opts.headers = { 'sec-websocket-protocol': protocols[0] };
            }

            srv.upgrade(req, opts);

            return;
        }

        const pathname = url.pathname;

        // Delay: /delay/:seconds
        const delayMatch = pathname.match(/^\/delay\/(\d+)$/);

        if (delayMatch) {
            const seconds = parseInt(delayMatch[1]);

            await new Promise(r => setTimeout(r, seconds * 1000));

            return Response.json({ delay: seconds });
        }

        // Bytes: /bytes/:count
        const bytesMatch = pathname.match(/^\/bytes\/(\d+)$/);

        if (bytesMatch) {
            const count = parseInt(bytesMatch[1]);
            const data = new Uint8Array(count);

            for (let i = 0; i < count; i++) {
                data[i] = i & 0xFF;
            }

            return new Response(data, {
                headers: { 'Content-Type': 'application/octet-stream' },
            });
        }

        // GET /get
        if (pathname === '/get' && req.method === 'GET') {
            const headers = {};

            for (const [ k, v ] of req.headers) {
                headers[k] = v;
            }

            const args = {};

            for (const [ k, v ] of url.searchParams) {
                args[k] = v;
            }

            return Response.json({ args, headers, url: req.url });
        }

        // POST /post
        if (pathname === '/post' && req.method === 'POST') {
            const contentType = req.headers.get('content-type') || '';
            const body = await req.text();
            const headers = {};

            for (const [ k, v ] of req.headers) {
                headers[k] = v;
            }

            let data;

            if (contentType.includes('application/json')) {
                try {
                    data = JSON.parse(body);
                } catch {
                    data = body;
                }
            } else {
                data = body;
            }

            return Response.json({ data, headers, url: req.url });
        }

        // Compression: /gzip
        if (pathname === '/gzip') {
            const json = JSON.stringify({ gzipped: true, method: 'GET', origin: '127.0.0.1' });
            const compressed = await compressData(json, 'gzip');

            return new Response(compressed, {
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Encoding': 'gzip',
                },
            });
        }

        // Compression: /deflate
        if (pathname === '/deflate') {
            const json = JSON.stringify({ deflated: true, method: 'GET', origin: '127.0.0.1' });
            const compressed = await compressData(json, 'deflate');

            return new Response(compressed, {
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Encoding': 'deflate',
                },
            });
        }

        // Redirect: /redirect → /redirect-target
        if (pathname === '/redirect') {
            return new Response(null, {
                status: 301,
                headers: {
                    'Location': `http://127.0.0.1:${serverPort}/redirect-target`,
                },
            });
        }

        if (pathname === '/redirect-target') {
            return new Response('Redirected!', {
                headers: { 'Content-Type': 'text/html' },
            });
        }

        // Response headers (like httpbin /response-headers).
        if (pathname === '/response-headers') {
            const headers = new Headers({ 'Content-Type': 'application/json' });

            for (const [ k, v ] of url.searchParams) {
                headers.append(k, v);
            }

            return new Response('{}', { headers });
        }

        // Cookies.
        if (pathname === '/cookies') {
            const cookieHeader = req.headers.get('cookie') || '';
            const cookies = {};

            if (cookieHeader) {
                for (const part of cookieHeader.split(';')) {
                    const eq = part.indexOf('=');

                    if (eq !== -1) {
                        const k = part.slice(0, eq).trim();
                        const v = part.slice(eq + 1).trim();

                        cookies[k] = v;
                    }
                }
            }

            return Response.json({ cookies });
        }

        // Image.
        if (pathname === '/image.jpg') {
            return new Response(JPEG_DATA, {
                headers: { 'Content-Type': 'image/jpeg' },
            });
        }

        // Lodash mock.
        if (pathname === '/lodash.js') {
            return new Response(LODASH_MOCK, {
                headers: { 'Content-Type': 'application/javascript' },
            });
        }

        return new Response('Not Found', { status: 404 });
    },
    websocket: {
        message(ws, data) {
            if (typeof data === 'string') {
                ws.sendText(data);
            } else {
                ws.sendBinary(data);
            }
        },
    },
};
