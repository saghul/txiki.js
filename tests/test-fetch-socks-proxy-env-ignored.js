import assert from 'tjs:assert';
import path from 'tjs:path';

// txiki.js parses the proxy environment itself (http_proxy, https_proxy,
// all_proxy, no_proxy) and never honours socks_proxy. It tells lws "no socks
// proxy" with an empty address, which lws >= 5.1 would otherwise reject or
// replace with the socks_proxy environment variable
// (patches/lws-socks5-empty-address-disables.patch). With socks_proxy
// pointing at a closed port, a direct fetch must still go direct.

const helperPath = path.join(import.meta.dirname, 'helpers', 'fetch-proxy-client.js');

let closedPort;
{
    await using listener = await tjs.listen('tcp', '127.0.0.1', 0);

    closedPort = (await listener.opened).localPort;
}

const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    fetch: () => new Response('direct'),
});

const env = { ...tjs.env };

for (const k of [
    'http_proxy', 'HTTP_PROXY', 'https_proxy', 'HTTPS_PROXY',
    'all_proxy', 'ALL_PROXY', 'no_proxy', 'NO_PROXY',
]) {
    delete env[k];
}

env.socks_proxy = `127.0.0.1:${closedPort}`;
env.TARGET_URL = `http://127.0.0.1:${server.port}/`;

try {
    const proc = tjs.spawn([ tjs.exePath, 'run', helperPath ], {
        stdout: 'pipe',
        stderr: 'pipe',
        env,
    });
    const [ status, stdout, stderr ] = await Promise.all([ proc.wait(), proc.stdout.text(), proc.stderr.text() ]);

    assert.eq(status.exit_status, 0, `child failed: ${stderr}`);

    const result = JSON.parse(stdout.trim());

    assert.eq(result.status, 200, 'status is 200');
    assert.eq(result.body, 'direct', 'the fetch went direct, not through socks_proxy');
} finally {
    await server.close();
}
