import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// h3 only exists over QUIC, so it must never be offered on a TLS-over-TCP
// handshake. lws derives its default client ALPN list from the enabled roles,
// which on an HTTP/3-capable build meant offering "h2,h3,h3,wt,http/1.1" over
// TCP. Most servers ignore the impossible entries, but some (Fastly) select h3,
// and lws then takes its QUIC-negotiated-h3 path on a TCP socket, migrating the
// connection to a new wsi; the next request on that connection is left queued on
// lws's transaction queue and never sent, so fetch() never settles (seen as any
// request to reddit.com or www.fastly.com hanging forever).
//
// The server here advertises h3 ahead of h2, so it selects h3 from any client
// list that offers it. A client that offers only protocols TCP can actually
// carry negotiates h2 instead.
// allowInsecure accepts the self-signed fixture certificate.

const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    tls: { cert, key, alpn: [ 'h3', 'h2' ] },
    fetch: (req, info) => new Response(info.httpVersion),
});

try {
    const r = await fetch(`https://127.0.0.1:${server.port}/`, { allowInsecure: true });

    assert.eq(r.status, 200, 'status is 200');
    assert.eq(await r.text(), '2', 'negotiated h2, not h3, over TCP');
} finally {
    await server.close();
}
