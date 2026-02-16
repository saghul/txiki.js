import assert from 'tjs:assert';
import path from 'tjs:path';


const helpersDir = path.join(import.meta.dirname, 'helpers');

async function spawnServe(filename, extraArgs = []) {
    const args = [
        tjs.exePath,
        'serve',
        ...extraArgs,
        path.join(helpersDir, filename),
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });

    // Read stdout until we see the "Listening on" line to extract the port.
    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let port;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        buf += decoder.decode(value, { stream: true });

        const match = buf.match(/Listening on http:\/\/localhost:(\d+)\//);

        if (match) {
            port = Number(match[1]);
            break;
        }
    }

    reader.releaseLock();

    if (!port) {
        proc.kill('SIGTERM');
        await proc.wait();
        throw new Error('Server did not print listening message');
    }

    return { proc, port };
}

async function testServeBasic() {
    const { proc, port } = await spawnServe('serve-simple.js');

    try {
        const resp = await fetch(`http://127.0.0.1:${port}/`);
        assert.eq(resp.status, 200, 'status is 200');

        const text = await resp.text();
        assert.eq(text, 'hello from serve', 'body matches');
    } finally {
        proc.kill('SIGTERM');
        await proc.wait();
    }
}

async function testServeEcho() {
    const { proc, port } = await spawnServe('serve-simple.js');

    try {
        const resp = await fetch(`http://127.0.0.1:${port}/echo`, {
            method: 'POST',
            body: 'test body',
        });
        assert.eq(resp.status, 200, 'status is 200');

        const text = await resp.text();
        assert.eq(text, 'echo: test body', 'echo body matches');
    } finally {
        proc.kill('SIGTERM');
        await proc.wait();
    }
}

async function testServeCustomPort() {
    const { proc, port } = await spawnServe('serve-simple.js', [ '--port', '0' ]);

    try {
        assert.ok(port > 0, 'port was assigned');

        const resp = await fetch(`http://127.0.0.1:${port}/`);
        assert.eq(resp.status, 200, 'status is 200');

        const text = await resp.text();
        assert.eq(text, 'hello from serve', 'body matches');
    } finally {
        proc.kill('SIGTERM');
        await proc.wait();
    }
}

async function testServeCustomPortShort() {
    const { proc, port } = await spawnServe('serve-simple.js', [ '-p', '0' ]);

    try {
        assert.ok(port > 0, 'port was assigned');

        const resp = await fetch(`http://127.0.0.1:${port}/`);
        const text = await resp.text();
        assert.eq(text, 'hello from serve', 'body matches with -p flag');
    } finally {
        proc.kill('SIGTERM');
        await proc.wait();
    }
}

async function testServeWebSocket() {
    const { proc, port } = await spawnServe('serve-ws.js');

    try {
        // Test that non-WS requests still work.
        const resp = await fetch(`http://127.0.0.1:${port}/`);
        assert.eq(await resp.text(), 'not a websocket request', 'non-ws request works');

        // Test WebSocket echo.
        const ws = new WebSocket(`ws://127.0.0.1:${port}`);

        const result = await new Promise((resolve, reject) => {
            ws.onopen = () => ws.send('hello ws');
            ws.onmessage = (e) => {
                resolve(e.data);
                ws.close();
            };
            ws.onerror = () => reject(new Error('WebSocket error'));
        });

        assert.eq(result, 'echo: hello ws', 'ws echo matches');
    } finally {
        proc.kill('SIGTERM');
        await proc.wait();
    }
}

async function testServeNoFile() {
    const args = [
        tjs.exePath,
        'serve',
    ];
    const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'pipe' });
    const status = await proc.wait();
    assert.ok(status.exit_status !== 0, 'exits with error when no file given');
}

await testServeBasic();
await testServeEcho();
await testServeCustomPort();
await testServeCustomPortShort();
await testServeWebSocket();
await testServeNoFile();
