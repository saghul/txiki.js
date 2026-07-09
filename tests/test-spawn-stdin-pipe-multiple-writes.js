import assert from 'tjs:assert';
import path from 'tjs:path';

// Regression test: every write to a spawned child's piped stdin must be
// delivered and its promise must resolve. The sink used to misread the
// boolean returned by the native write() as an async completion and await
// an onwrite callback that never fired, so the first (inline) write jammed
// the WritableStream queue forever.

const catScript = path.join(import.meta.dirname, 'helpers', 'stdin-cat.js');
const proc = tjs.spawn([ tjs.exePath, 'run', catScript ], { stdin: 'pipe', stdout: 'pipe' });

const writer = proc.stdin.getWriter();
const encoder = new TextEncoder();
const chunks = [ 'one\n', 'two\n', 'three\n' ];

for (const chunk of chunks) {
    await writer.write(encoder.encode(chunk));
}

await writer.close();

const output = await proc.stdout.text();

assert.eq(output, chunks.join(''), 'child received every stdin write');

await proc.wait();
