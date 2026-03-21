import assert from 'tjs:assert';
import path from 'tjs:path';


const decoder = new TextDecoder();
const helperPath = path.join(import.meta.dirname, 'helpers', 'fetch-proxy-client.js');
const proxyPath = path.join(import.meta.dirname, 'helpers', 'connect-proxy.js');


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


async function startProxy() {
    const proc = tjs.spawn([ tjs.exePath, 'run', proxyPath ], {
        stdout: 'pipe',
        stderr: 'pipe',
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

    const port = parseInt(buf.trim());

    return { proc, port };
}


function cleanProxyEnv(env) {
    delete env.http_proxy;
    delete env.HTTP_PROXY;
    delete env.https_proxy;
    delete env.HTTPS_PROXY;
    delete env.all_proxy;
    delete env.ALL_PROXY;
    delete env.no_proxy;
    delete env.NO_PROXY;
}


// Test that http_proxy routes requests through the proxy.
async function testHttpProxy() {
    // Backend server: returns a known response.
    const backend = tjs.serve({
        port: 0,
        fetch: () => new Response('hello via proxy'),
    });

    // Start CONNECT proxy as a separate process.
    const proxy = await startProxy();

    const targetUrl = `http://127.0.0.1:${backend.port}/hello`;
    const env = { ...tjs.env };
    cleanProxyEnv(env);
    env.http_proxy = `http://127.0.0.1:${proxy.port}`;
    env.TARGET_URL = targetUrl;

    const { status, stdout, stderr } = await runHelper(env);

    assert.eq(status.exit_status, 0, `child failed: ${stderr}`);

    const result = JSON.parse(stdout.trim());

    assert.eq(result.status, 200, 'status is 200');
    assert.eq(result.body, 'hello via proxy', 'response body from backend via proxy');

    proxy.proc.kill();
    backend.close();
}


// Test that requests work without http_proxy set.
async function testNoProxy() {
    const backend = tjs.serve({
        port: 0,
        fetch: () => new Response('direct'),
    });

    const env = { ...tjs.env };
    cleanProxyEnv(env);
    env.TARGET_URL = `http://127.0.0.1:${backend.port}/hello`;

    const { status, stdout, stderr } = await runHelper(env);

    assert.eq(status.exit_status, 0, `child failed: ${stderr}`);

    const result = JSON.parse(stdout.trim());

    assert.eq(result.status, 200, 'status is 200');
    assert.eq(result.body, 'direct', 'request went directly to backend');

    backend.close();
}


// Test that all_proxy is used as fallback for http targets.
async function testAllProxyFallback() {
    const backend = tjs.serve({
        port: 0,
        fetch: () => new Response('hello via all_proxy'),
    });

    const proxy = await startProxy();

    const targetUrl = `http://127.0.0.1:${backend.port}/hello`;
    const env = { ...tjs.env };
    cleanProxyEnv(env);
    env.all_proxy = `http://127.0.0.1:${proxy.port}`;
    env.TARGET_URL = targetUrl;

    const { status, stdout, stderr } = await runHelper(env);

    assert.eq(status.exit_status, 0, `child failed: ${stderr}`);

    const result = JSON.parse(stdout.trim());

    assert.eq(result.status, 200, 'status is 200');
    assert.eq(result.body, 'hello via all_proxy', 'all_proxy used as fallback');

    proxy.proc.kill();
    backend.close();
}


// Test that https_proxy is NOT used for http:// targets (per-scheme selection).
async function testHttpsProxyNotUsedForHttp() {
    const backend = tjs.serve({
        port: 0,
        fetch: () => new Response('direct without proxy'),
    });

    const targetUrl = `http://127.0.0.1:${backend.port}/hello`;
    const env = { ...tjs.env };
    cleanProxyEnv(env);
    // Only set https_proxy, not http_proxy — should go direct for http:// target.
    env.https_proxy = 'http://127.0.0.1:9999';
    env.TARGET_URL = targetUrl;

    const { status, stdout, stderr } = await runHelper(env);

    assert.eq(status.exit_status, 0, `child failed: ${stderr}`);

    const result = JSON.parse(stdout.trim());

    assert.eq(result.status, 200, 'status is 200');
    assert.eq(result.body, 'direct without proxy', 'https_proxy not used for http target');

    backend.close();
}


// Test that no_proxy bypasses the proxy for a specific host.
async function testNoProxyBypass() {
    const backend = tjs.serve({
        port: 0,
        fetch: () => new Response('bypassed proxy'),
    });

    const proxy = await startProxy();

    const targetUrl = `http://127.0.0.1:${backend.port}/hello`;
    const env = { ...tjs.env };
    cleanProxyEnv(env);
    env.http_proxy = `http://127.0.0.1:${proxy.port}`;
    env.no_proxy = '127.0.0.1';
    env.TARGET_URL = targetUrl;

    const { status, stdout, stderr } = await runHelper(env);

    assert.eq(status.exit_status, 0, `child failed: ${stderr}`);

    const result = JSON.parse(stdout.trim());

    assert.eq(result.status, 200, 'status is 200');
    assert.eq(result.body, 'bypassed proxy', 'no_proxy bypassed the proxy');

    proxy.proc.kill();
    backend.close();
}


// Test that no_proxy=* bypasses all proxies.
async function testNoProxyWildcard() {
    const backend = tjs.serve({
        port: 0,
        fetch: () => new Response('wildcard bypass'),
    });

    const targetUrl = `http://127.0.0.1:${backend.port}/hello`;
    const env = { ...tjs.env };
    cleanProxyEnv(env);
    env.http_proxy = 'http://127.0.0.1:9999';
    env.no_proxy = '*';
    env.TARGET_URL = targetUrl;

    const { status, stdout, stderr } = await runHelper(env);

    assert.eq(status.exit_status, 0, `child failed: ${stderr}`);

    const result = JSON.parse(stdout.trim());

    assert.eq(result.status, 200, 'status is 200');
    assert.eq(result.body, 'wildcard bypass', 'no_proxy=* bypassed all proxies');

    backend.close();
}


// Test that no_proxy with matching port bypasses the proxy.
async function testNoProxyPortMatch() {
    const backend = tjs.serve({
        port: 0,
        fetch: () => new Response('port bypass'),
    });

    const targetUrl = `http://127.0.0.1:${backend.port}/hello`;
    const env = { ...tjs.env };
    cleanProxyEnv(env);
    // Use a bogus proxy — if no_proxy works, it won't be contacted.
    env.http_proxy = 'http://127.0.0.1:9999';
    env.no_proxy = `127.0.0.1:${backend.port}`;
    env.TARGET_URL = targetUrl;

    const { status, stdout, stderr } = await runHelper(env);

    assert.eq(status.exit_status, 0, `child failed: ${stderr}`);

    const result = JSON.parse(stdout.trim());

    assert.eq(result.status, 200, 'status is 200');
    assert.eq(result.body, 'port bypass', 'no_proxy with matching port bypassed proxy');

    backend.close();
}


// Test that no_proxy with non-matching port does NOT bypass the proxy.
async function testNoProxyPortNoMatch() {
    const backend = tjs.serve({
        port: 0,
        fetch: () => new Response('should use proxy'),
    });

    const proxy = await startProxy();

    const targetUrl = `http://127.0.0.1:${backend.port}/hello`;
    const env = { ...tjs.env };
    cleanProxyEnv(env);
    env.http_proxy = `http://127.0.0.1:${proxy.port}`;
    // no_proxy specifies a different port — proxy should still be used.
    env.no_proxy = '127.0.0.1:99999';
    env.TARGET_URL = targetUrl;

    const { status, stdout, stderr } = await runHelper(env);

    assert.eq(status.exit_status, 0, `child failed: ${stderr}`);

    const result = JSON.parse(stdout.trim());

    assert.eq(result.status, 200, 'status is 200');
    assert.eq(result.body, 'should use proxy', 'no_proxy with non-matching port still uses proxy');

    proxy.proc.kill();
    backend.close();
}


await testHttpProxy();
await testAllProxyFallback();
await testHttpsProxyNotUsedForHttp();
await testNoProxy();
await testNoProxyBypass();
await testNoProxyWildcard();
await testNoProxyPortMatch();
await testNoProxyPortNoMatch();
