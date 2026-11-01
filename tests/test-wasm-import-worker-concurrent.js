import assert from 'tjs:assert';
import path from 'tjs:path';

// Workers linking JS imports concurrently share WAMR's process-global, unlocked
// native symbol list; txiki must serialize access to it or the list gets
// corrupted (crashes, or "failed to call unlinked import function").

const helperPath = path.join(import.meta.dirname, 'helpers', 'wasm-import-worker-concurrent.js');

const env = { ...tjs.env, WORKERS: '8', ROUNDS: tjs.env.TJS_GC_STRESS ? '20' : '2000' };
const proc = tjs.spawn([ tjs.exePath, 'run', helperPath ], {
    stdout: 'pipe',
    stderr: 'pipe',
    env,
});
const [ status, stdout, stderr ] = await Promise.all([ proc.wait(), proc.stdout.text(), proc.stderr.text() ]);

assert.eq(status.term_signal, null, `helper crashed: ${stderr}`);
assert.eq(status.exit_status, 0, `helper failed: ${stdout}\n${stderr}`);
