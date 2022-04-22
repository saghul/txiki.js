import assert from './assert.js';
import { path } from '@tjs/std';


(async () => {
    const args = [
        tjs.exepath,
        path.join(import.meta.dirname, 'helpers', 'sleep.js')
    ];
    const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'ignore' });
    tjs.kill(proc.pid, 'SIGKILL');
    const status = await proc.wait();

    if (tjs.platform === 'windows') {
        /* uv_kill() behaviour on Windows causes the process to exit 1 and
         * does not propagate the terminating signal information to the process
         * handle.
         */
        assert.eq(status.exit_status, 1);
    } else {
        assert.eq(status.term_signal, 'SIGKILL');
    }
})();
