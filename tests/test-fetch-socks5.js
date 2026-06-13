import assert from 'tjs:assert';
import path from 'tjs:path';


const decoder = new TextDecoder();
const helperPath = path.join(import.meta.dirname, 'helpers', 'fetch-proxy-client.js');
const socksPath = path.join(import.meta.dirname, 'helpers', 'socks5-proxy.js');


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


async function startSocks() {
    const proc = tjs.spawn([ tjs.exePath, 'run', socksPath ], {
        stdout: 'pipe',
        stderr: 'pipe',
    });
    const reader = proc.stdout.getReader();
    let buf = '';

    while (!buf.includes('\n')) {
        const { value, done } = await reader.read();

        if (done) {
            break;
        }

        buf += decoder.decode(value);
    }

    reader.releaseLock();

    return { proc, port: parseInt(buf.trim()) };
}


function cleanProxyEnv(env) {
    for (const k of [
        'http_proxy', 'HTTP_PROXY', 'https_proxy', 'HTTPS_PROXY',
        'all_proxy', 'ALL_PROXY', 'no_proxy', 'NO_PROXY',
    ]) {
        delete env[k];
    }
}


// A request with all_proxy=socks5://... must reach the backend through the
// SOCKS5 proxy.
async function testSocks5Proxy() {
    const backend = tjs.serve({
        port: 0,
        fetch: () => new Response('hello via socks5'),
    });

    const proxy = await startSocks();

    const env = { ...tjs.env };

    cleanProxyEnv(env);
    env.all_proxy = `socks5://127.0.0.1:${proxy.port}`;
    env.TARGET_URL = `http://127.0.0.1:${backend.port}/hello`;

    try {
        const { status, stdout, stderr } = await runHelper(env);

        assert.eq(status.exit_status, 0, `child failed: ${stderr}`);

        const result = JSON.parse(stdout.trim());

        assert.eq(result.status, 200, 'status is 200');
        assert.eq(result.body, 'hello via socks5', 'response body came back through the SOCKS5 proxy');
    } finally {
        proxy.proc.kill();
        await proxy.proc.wait();
        backend.close();
    }
}


await testSocks5Proxy();
