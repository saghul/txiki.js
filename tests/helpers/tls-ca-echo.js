import path from 'tjs:path';


const fixturesDir = path.join(import.meta.dirname, '..', 'fixtures');
const cert = new TextDecoder().decode(await tjs.readFile(path.join(fixturesDir, 'server-cert.pem')));
const key = new TextDecoder().decode(await tjs.readFile(path.join(fixturesDir, 'server-key.pem')));

const server = tjs.serve({
    port: 0,
    tls: { cert, key },
    fetch: async (req) => {
        const body = await req.text();

        return new Response(`echo: ${body}`);
    },
});

// Make an HTTPS request to the server.
const resp = await fetch(`https://127.0.0.1:${server.port}/`, {
    method: 'POST',
    body: 'hello',
});

if (resp.status !== 200) {
    server.close();
    throw new Error(`unexpected status: ${resp.status}`);
}

const text = await resp.text();

if (text !== 'echo: hello') {
    server.close();
    throw new Error(`unexpected body: ${text}`);
}

server.close();
