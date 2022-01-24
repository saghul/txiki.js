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
    const buf = new Uint8Array(4096);
    const nread = await proc.stderr.read(buf);
    const stderrStr = new TextDecoder().decode(buf.subarray(0, nread));
    const status = await proc.wait();
    assert.ok(stderrStr.match(/Unhandled promise rejection/) !== null, 'dumps to stderr');
    assert.ok(status.exit_status === 0 && status.term_signal === 0, 'succeeded')
})();
