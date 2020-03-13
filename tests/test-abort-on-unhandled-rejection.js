import assert from './assert.js';
import { dirname, join } from '@tjs/path';

const thisFile = import.meta.url.slice(7);   // strip "file://"


(async () => {
    const args = [
        tjs.exepath(),
        '--abort-on-unhandled-rejection',
        join(dirname(thisFile), 'helpers', 'unhandled-rejection.js')
    ];
    const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'ignore' });
    const status = await proc.wait();
    assert.ok(status.exit_status !== 0 || status.term_signal === tjs.signal.SIGABRT, 'process failed')
})();
