import assert from 'tjs:assert';
import path from 'tjs:path';

import { spawnServe } from './helpers/serve-spawn.js';

const { proc, port } = await spawnServe('serve-echo.js');

const args = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'helpers', 'import-http-delay.js')
];
const child = tjs.spawn(args, {
    env: { ...tjs.env, ECHO_PORT: String(port) },
});
const status = await child.wait();

proc.kill('SIGTERM');
await proc.wait();

assert.ok(status.exit_status !== 0 && status.term_signal === null);
