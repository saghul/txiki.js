import assert from 'tjs:assert';
import path from 'tjs:path';

// TLS 1.3 handshakes running concurrently on the main thread and several
// Workers share mbedtls' process-global PSA state; mbedtls must be built with
// its threading layer for that to be safe.

const caPath = path.join(import.meta.dirname, 'fixtures', 'ca.pem');
const helperPath = path.join(import.meta.dirname, 'helpers', 'tls-worker-concurrent.js');

const env = { ...tjs.env, WORKERS: '4', ROUNDS: tjs.env.TJS_GC_STRESS ? '2' : '10' };
const proc = tjs.spawn([ tjs.exePath, '--tls-ca', caPath, 'run', helperPath ], {
    stdout: 'pipe',
    stderr: 'pipe',
    env,
});
const [ status, stdout, stderr ] = await Promise.all([ proc.wait(), proc.stdout.text(), proc.stderr.text() ]);

assert.eq(status.term_signal, null, `helper crashed: ${stderr}`);
assert.eq(status.exit_status, 0, `helper failed: ${stdout}\n${stderr}`);
