// Fixture for test-fetch-cookie-secure-over-http.js.
//
// Runs in a child process with an isolated TJS_HOME. An http:// server sets a
// Secure cookie and, in a separate response, a plain one; a third credentialed
// request reports the Cookie header it got. Prints that header as JSON.

let sawCookie = null;

const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    fetch: req => {
        const url = new URL(req.url);

        if (url.pathname === '/secure') {
            return new Response('ok', { headers: { 'Set-Cookie': 'sec=s1; Path=/; Secure' } });
        }

        if (url.pathname === '/plain') {
            return new Response('ok', { headers: { 'Set-Cookie': 'plain=p1; Path=/' } });
        }

        sawCookie = req.headers.get('cookie');

        return new Response('ok');
    },
});

const base = `http://127.0.0.1:${server.port}`;

for (const p of [ '/secure', '/plain', '/check' ]) {
    await (await fetch(`${base}${p}`, { credentials: 'include' })).text();
}

await server.close();

console.log(JSON.stringify({ cookie: sawCookie }));
