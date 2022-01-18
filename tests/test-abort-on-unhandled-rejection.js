import assert from './assert.js';
import { path } from '@tjs/std';

const { dirname, join } = path;

const thisFile = import.meta.url.slice(7);   // strip "file://"


(async () => {
    const args = [
        tjs.exepath(),
        '--no-abort-on-unhandled-rejection',
        join(dirname(thisFile), 'helpers', 'unhandled-rejection.js')
    ];
    const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'pipe' });
    const stderr = await proc.stderr.read();
    const stderrStr = new TextDecoder().decode(stderr);
    const status = await proc.wait();
    assert.ok(stderrStr.match(/Unhandled promise rejection/) !== null, 'dumps to stderr');
    assert.ok(status.exit_status === 0 && status.term_signal === 0, 'succeeded')
})();
