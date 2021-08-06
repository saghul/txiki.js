import assert from './assert.js';
import { dirname, join } from '@tjs/path';

const thisFile = import.meta.url.slice(7);   // strip "file://"


(async () => {
    const args = [
        tjs.exepath(),
        join(dirname(thisFile), 'wasi', 'launcher.js'),
        'test.wasm'
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe' });
    const status = await proc.wait();
    assert.eq(status.exit_status, 0, 'WASI ran succesfully')
    assert.eq(status.term_signal, 0, 'WASI ran succesfully 2')
    const data = await proc.stdout.read(4096);
    assert.ok(data.length > 0, 'stdout was read');
    const dataStr = new TextDecoder().decode(data);
    assert.ok(dataStr.match(/Hello world/), 'data matches 1');
    assert.ok(dataStr.match(/Constructor OK/), 'data matches 2');
    assert.ok(dataStr.match(/Hello printf!/), 'data matches 3');
    assert.ok(dataStr.match(/fib\(20\)/), 'data matches 4');
})();
