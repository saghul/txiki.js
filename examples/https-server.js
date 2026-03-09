// Sample HTTPS server.
//
// First generate a self-signed certificate:
//
//   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=localhost'
//
// Run with: tjs serve --tls-cert cert.pem --tls-key key.pem examples/https-server.js
//
// Or programmatically:
//
//   tjs run examples/https-server.js
//

const cert = new TextDecoder().decode(await tjs.readFile('cert.pem'));
const key = new TextDecoder().decode(await tjs.readFile('key.pem'));

const server = tjs.serve({
    port: 8443,
    tls: { cert, key },
    fetch(request) {
        const url = new URL(request.url);

        return new Response(`Hello HTTPS!\nYou requested: ${url.pathname}\n`);
    },
});

console.log(`Listening on https://localhost:${server.port}/`);
