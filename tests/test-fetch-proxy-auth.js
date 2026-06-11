import assert from 'tjs:assert';
import path from 'tjs:path';


const decoder = new TextDecoder();
const helperPath = path.join(import.meta.dirname, 'helpers', 'fetch-proxy-client.js');
const proxyPath = path.join(import.meta.dirname, 'helpers', 'connect-proxy-auth.js');

// The request target is a dead port: the request can only succeed by being
// tunnelled through the auth proxy (which ignores this target and connects to
// the real backend). If the authenticated proxy were silently dropped, the
// client would hit this dead port directly and fail.
const DEAD_TARGET = 'http://127.0.0.1:1/hello';


async function runHelper(env) {
    const proc = tjs.spawn([ tjs.exePath, 'run', helperPath ], {
        stdout: 'pipe',
        stderr: 'pipe',
        env,
    });
    const [ status, stdout, stderr ] = (
        await Promise.allSettled([ proc.wait(), proc.stdout.text(), proc.stderr.text() ])
    ).map(r => r.value);

    return { status, stdout, stderr };
}


async function startAuthProxy(backendPort, auth) {
    const proc = tjs.spawn([ tjs.exePath, 'run', proxyPath ], {
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...tjs.env, PROXY_AUTH: auth, BACKEND_PORT: String(backendPort) },
    });

    // Read the port from the proxy's first line of stdout.
    const reader = proc.stdout.getReader();
    let buf = '';

    while (true) {
        const { value, done } = await reader.read();

        if (done) {
            break;
        }

        buf += decoder.decode(value);

        if (buf.includes('\n')) {
            break;
        }
    }

    reader.releaseLock();

    return { proc, port: parseInt(buf.trim()) };
}


// An authenticated proxy URL (user:pass@host) routes through the proxy and
// sends the Proxy-Authorization header. Regression test: lws_parse_uri_create
// can't parse userinfo, so we must split it off ourselves — otherwise the
// proxy is silently dropped.
async function testAuthProxy() {
    const backend = tjs.serve({
        port: 0,
        fetch: () => new Response('hello via auth proxy'),
    });

    const proxy = await startAuthProxy(backend.port, 'user:pass');

    const env = { ...tjs.env };
    env.http_proxy = `http://user:pass@127.0.0.1:${proxy.port}`;
    env.TARGET_URL = DEAD_TARGET;

    const { status, stdout, stderr } = await runHelper(env);

    assert.eq(status.exit_status, 0, `child failed: ${stderr}`);

    const result = JSON.parse(stdout.trim());

    assert.eq(result.status, 200, 'status is 200');
    assert.eq(result.body, 'hello via auth proxy', 'response came through the authenticated proxy');

    proxy.proc.kill();
    backend.close();
}


// Wrong proxy credentials are rejected (407): the proxy is genuinely
// authenticating, and the request does not tunnel through.
async function testAuthProxyWrongCreds() {
    const backend = tjs.serve({
        port: 0,
        fetch: () => new Response('should not arrive'),
    });

    const proxy = await startAuthProxy(backend.port, 'user:pass');

    const env = { ...tjs.env };
    env.http_proxy = `http://user:wrong@127.0.0.1:${proxy.port}`;
    env.TARGET_URL = DEAD_TARGET;

    const { status, stdout } = await runHelper(env);

    // The proxy answers 407 to the CONNECT, so the fetch must not succeed with
    // the backend's body.
    const succeeded = status.exit_status === 0 && stdout.includes('should not arrive');

    assert.ok(!succeeded, 'request must not tunnel with wrong credentials');

    proxy.proc.kill();
    backend.close();
}


await testAuthProxy();
await testAuthProxyWrongCreds();
