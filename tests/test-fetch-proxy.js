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
    const env = {
        ...tjs.env,
        http_proxy: `http://127.0.0.1:${proxy.port}`,
        TARGET_URL: targetUrl,
    };

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

    const env = { ...tjs.env, TARGET_URL: `http://127.0.0.1:${backend.port}/hello` };

    delete env.http_proxy;
    delete env.https_proxy;
    delete env.HTTPS_PROXY;
    delete env.all_proxy;
    delete env.ALL_PROXY;

    const { status, stdout, stderr } = await runHelper(env);

    assert.eq(status.exit_status, 0, `child failed: ${stderr}`);

    const result = JSON.parse(stdout.trim());

    assert.eq(result.status, 200, 'status is 200');
    assert.eq(result.body, 'direct', 'request went directly to backend');

    backend.close();
}


// Test that https_proxy is used as fallback.
async function testHttpsProxyFallback() {
    const backend = tjs.serve({
        port: 0,
        fetch: () => new Response('hello via https_proxy'),
    });

    const proxy = await startProxy();

    const targetUrl = `http://127.0.0.1:${backend.port}/hello`;
    const env = {
        ...tjs.env,
        https_proxy: `http://127.0.0.1:${proxy.port}`,
        TARGET_URL: targetUrl,
    };

    delete env.http_proxy;

    const { status, stdout, stderr } = await runHelper(env);

    assert.eq(status.exit_status, 0, `child failed: ${stderr}`);

    const result = JSON.parse(stdout.trim());

    assert.eq(result.status, 200, 'status is 200');
    assert.eq(result.body, 'hello via https_proxy', 'https_proxy used as fallback');

    proxy.proc.kill();
    backend.close();
}


await testHttpProxy();
await testHttpsProxyFallback();
await testNoProxy();
