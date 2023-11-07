import assert from 'tjs:assert';
import path from 'tjs:path';

const NUM_TRIES = 10;

for (let i = 0; i < NUM_TRIES; i++) {
    const args = [
        tjs.exepath,
        'run',
        path.join(import.meta.dirname, 'helpers', 'bad.js')
    ];
    const proc = tjs.spawn(args);
    const status = await proc.wait();

    assert.ok(status.exit_status !== 0 && status.term_signal === null, 'succeeded')
}
