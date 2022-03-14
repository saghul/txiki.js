import assert from './assert.js';
import { path } from '@tjs/std';


(async () => {
    const args = [
        tjs.exepath,
        path.join(import.meta.dirname, 'helpers', 'unhandled-rejection.js')
    ];
    const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'pipe' });
    const buf = new Uint8Array(4096);
    const nread = await proc.stderr.read(buf);
    const stderrStr = new TextDecoder().decode(buf.subarray(0, nread));
    const status = await proc.wait();
    assert.ok(stderrStr.match(/Unhandled promise rejection/) !== null, 'dumps to stderr');
    assert.ok(status.exit_status === 1 && status.term_signal === null, 'succeeded');
})();
