import path from 'tjs:path';


const helpersDir = import.meta.dirname;

export async function spawnServe(filename, extraArgs = []) {
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
