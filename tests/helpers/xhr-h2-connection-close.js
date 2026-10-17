import cert from '../fixtures/server-cert.pem' with { type: 'text' };
import key from '../fixtures/server-key.pem' with { type: 'text' };

const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    tls: { cert, key, alpn: [ 'h2' ] },
    fetch: (req, info) => new Response(`v:${info.httpVersion} conn:${req.headers.get('connection')}`),
});

try {
    const { promise, resolve, reject } = Promise.withResolvers();
    const xhr = new XMLHttpRequest();

    xhr.open('GET', `https://127.0.0.1:${server.port}/`);
    xhr.setRequestHeader('Connection', 'close');
    xhr.onload = () => resolve(`${xhr.status} ${xhr.responseText}`);
    xhr.onerror = () => reject(new Error('xhr failed'));
    xhr.send();

    console.log(await promise);
} finally {
    await server.close();
}
