// Fixture for test-serve-set-cookie-h2.js.
//
// Runs in a child process with an isolated TJS_HOME (the cookie jar is a
// process-level singleton fixed at startup). An h2-only server sets two
// cookies; a credentialed fetch stores them and a second one sends them back.
// Prints the Cookie header the server received on the second request.
import cert from '../fixtures/server-cert.pem' with { type: 'text' };
import key from '../fixtures/server-key.pem' with { type: 'text' };

const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    tls: { cert, key, alpn: [ 'h2' ] },
    fetch: (req, { httpVersion }) => {
        const headers = new Headers();

        if (new URL(req.url).pathname === '/set') {
            headers.append('Set-Cookie', 'a=1; Path=/');
            headers.append('Set-Cookie', 'b=2; Path=/');
        }

        return new Response(JSON.stringify({ httpVersion, cookie: req.headers.get('cookie') }), { headers });
    },
});

const opts = { allowInsecure: true, credentials: 'include' };
const base = `https://127.0.0.1:${server.port}`;

await (await fetch(`${base}/set`, opts)).text();

const r = await fetch(`${base}/check`, opts);

console.log(await r.text());

await server.close();
