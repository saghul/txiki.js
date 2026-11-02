import assert from 'tjs:assert';
import path from 'tjs:path';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// The module loader fetches https imports over its own one-shot lws context,
// separate from fetch(). It must not offer h3 on the TLS-over-TCP handshake
// either (see test-fetch-alpn-no-h3-over-tcp.js). Left to its default list,
// lws offered "h2,h3,h3,wt,http/1.1" here, so a server that prefers h3 picked
// it on a TCP connection.
//
// The server advertises h3 ahead of h2, so it selects h3 whenever the client
// offers it. The module reports the HTTP version it was served over, which is
// h2 only if h3 was not on offer.
//
// The loader blocks its own process while it waits, so the import runs in a
// child process, which trusts the fixture certificate through TJS_CA_BUNDLE.

const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    tls: { cert, key, alpn: [ 'h3', 'h2' ] },
    fetch: (req, info) => new Response(`export default '${info.httpVersion}';`, {
        headers: { 'content-type': 'text/javascript' },
    }),
});

try {
    const url = `https://127.0.0.1:${server.port}/mod.js`;
    const code = `const m = await import('${url}'); console.log(m.default);`;
    const proc = tjs.spawn([ tjs.exePath, 'eval', code ], {
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...tjs.env, TJS_CA_BUNDLE: path.join(import.meta.dirname, 'fixtures', 'ca.pem') },
    });
    const [ status, stdout, stderr ] = await Promise.all([ proc.wait(), proc.stdout.text(), proc.stderr.text() ]);

    assert.eq(status.exit_status, 0, `import succeeded: ${stderr}`);
    assert.eq(stdout.trim(), '2', 'negotiated h2, not h3, over TCP');
} finally {
    await server.close();
}
