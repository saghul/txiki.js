// Fixture for test-fetch-cookie-jar-locked.js.
//
// Runs in a child process whose TJS_HOME cookie jar is locked by "another
// process" (the parent created cookies.txt.LCK). A server sets a persistent
// and a session cookie, both with Path=/; a credentialed request to a deeper
// path reports the Cookie header it got. Prints that header as JSON.

let sawCookie = null;

const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    fetch: req => {
        const url = new URL(req.url);

        if (url.pathname === '/set') {
            const headers = new Headers();

            headers.append('Set-Cookie', 'kept=k1; Path=/; Expires=Thu, 01 Jan 2099 00:00:00 GMT');
            headers.append('Set-Cookie', 'sess=s1; Path=/');

            return new Response('ok', { headers });
        }

        sawCookie = req.headers.get('cookie');

        return new Response('ok');
    },
});

const base = `http://127.0.0.1:${server.port}`;

for (const p of [ '/set', '/a/b/check' ]) {
    await (await fetch(`${base}${p}`, { credentials: 'include' })).text();
}

await server.close();

console.log(JSON.stringify({ cookie: sawCookie }));
