import assert from './assert.js';
import { path } from '@tjs/std';


(async () => {
    const args = [
        tjs.exepath,
        path.join(import.meta.dirname, 'helpers', 'sleep.js')
    ];
    const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'ignore' });
    proc.kill('SIGKILL');
    const status = await proc.wait();
    assert.eq(status.term_signal, 'SIGKILL');
})();
