// Fixture for test-fetch-cookie-secure-httponly.js (issue #1064).
//
// Runs in a child process with an isolated TJS_HOME so the cookie jar it
// writes can be inspected without touching the user's real ~/.tjs. Replays
// the exact repro from the issue: a credentialed request against a server
// whose Set-Cookie carries the Secure and HttpOnly flags.
const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    fetch: () => new Response(null, {
        status: 302,
        headers: {
            'Location': '/',
            'Set-Cookie': 'session=abc123def456; Path=/; Secure; HttpOnly',
        },
    }),
});

await fetch(`http://127.0.0.1:${server.port}/login`, {
    method: 'POST',
    redirect: 'manual',
    credentials: 'include',
});

await server.close();
