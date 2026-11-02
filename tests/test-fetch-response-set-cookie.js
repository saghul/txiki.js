import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// Repeated Set-Cookie response headers must reach fetch() and XHR as separate
// values, not joined into one string, on both HTTP/1.1 and HTTP/2.

const COOKIES = [ 'a=1; Path=/', 'b=2; Path=/; Expires=Wed, 21 Oct 2037 07:28:00 GMT' ];

function handler(req, { httpVersion }) {
    const headers = new Headers({ 'x-http-version': httpVersion });

    for (const c of COOKIES) {
        headers.append('Set-Cookie', c);
    }

    return new Response('ok', { headers });
}

function xhrHeaders(url) {
    const { promise, resolve, reject } = Promise.withResolvers();
    const xhr = new XMLHttpRequest();

    xhr.open('GET', url);
    xhr.onload = () => resolve(xhr.getAllResponseHeaders());
    xhr.onerror = reject;
    xhr.send();

    return promise;
}

const h1 = tjs.serve({ port: 0, listenIp: '127.0.0.1', fetch: handler });
const h2 = tjs.serve({ port: 0, listenIp: '127.0.0.1', tls: { cert, key, alpn: [ 'h2' ] }, fetch: handler });

try {
    const cases = [
        [ `http://127.0.0.1:${h1.port}/`, '1.1' ],
        [ `https://127.0.0.1:${h2.port}/`, '2' ],
    ];

    for (const [ url, version ] of cases) {
        const res = await fetch(url, { allowInsecure: true });

        await res.text();

        assert.eq(res.headers.get('x-http-version'), version, `request to ${url} went over HTTP/${version}`);
        assert.eq(res.headers.getSetCookie(), COOKIES, `fetch over HTTP/${version} sees each Set-Cookie separately`);
    }

    const lines = (await xhrHeaders(`http://127.0.0.1:${h1.port}/`))
        .split('\r\n')
        .filter(l => l.toLowerCase().startsWith('set-cookie:'));

    assert.eq(lines, COOKIES.map(c => `set-cookie: ${c}`), 'XHR lists one set-cookie line per cookie');
} finally {
    await h1.close();
    await h2.close();
}
