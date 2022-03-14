import assert from './assert.js';
import { path } from '@tjs/std';


(async () => {
    const args = [
        tjs.exepath,
        path.join(import.meta.dirname, 'wasi', 'launcher.js'),
        'test.wasm'
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe' });
    const status = await proc.wait();
    assert.eq(status.exit_status, 0, 'WASI ran succesfully');
    assert.eq(status.term_signal, null, 'WASI ran succesfully 2');
    const buf = new Uint8Array(4096);
    const nread = await proc.stdout.read(buf);
    assert.ok(nread > 0, 'stdout was read');
    const dataStr = new TextDecoder().decode(buf.subarray(0, nread));
    assert.ok(dataStr.match(/Hello world/), 'data matches 1');
    assert.ok(dataStr.match(/Constructor OK/), 'data matches 2');
    assert.ok(dataStr.match(/Hello printf!/), 'data matches 3');
    assert.ok(dataStr.match(/fib\(20\)/), 'data matches 4');
})();
