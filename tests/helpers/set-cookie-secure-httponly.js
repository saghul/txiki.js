// Fixture for test-fetch-cookie-secure-httponly.js (issue #1064).
//
// Runs in a child process with an isolated TJS_HOME so the cookie jar it
// writes can be inspected without touching the user's real ~/.tjs. Replays
// the repro from the issue: a credentialed request against a server whose
// Set-Cookie carries the Secure and HttpOnly flags. The server is https: a
// Secure cookie is only stored when it was set over a secure connection
// (RFC 6265bis 5.7), so over http the jar would rightly stay empty.
// allowInsecure accepts the self-signed fixture certificate.
import cert from '../fixtures/server-cert.pem' with { type: 'text' };
import key from '../fixtures/server-key.pem' with { type: 'text' };

const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    tls: { cert, key },
    fetch: () => new Response(null, {
        status: 302,
        headers: {
            'Location': '/',
            'Set-Cookie': 'session=abc123def456; Path=/; Secure; HttpOnly',
        },
    }),
});

await fetch(`https://127.0.0.1:${server.port}/login`, {
    method: 'POST',
    redirect: 'manual',
    credentials: 'include',
    allowInsecure: true,
});

await server.close();
