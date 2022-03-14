import assert from './assert.js';
import { path } from '@tjs/std';


(async () => {
    const args = [
        tjs.exepath,
        path.join(import.meta.dirname, 'helpers', 'log-import-meta.js')
    ];
    const proc = tjs.spawn(args);
    const status = await proc.wait();
    // If the file is evaluated as a global script instead of a module, it will give an error
    // because import.meta cannot be used in that case.
    assert.ok(status.exit_status === 0 && status.term_signal === null, 'succeeded')
})();
