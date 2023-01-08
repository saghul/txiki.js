import assert from '@tjs/std/assert';
import { mkstemp, open } from '@tjs/fs';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

(async () => {
    const f = await mkstemp(`${tjs.tmpdir()}/testFile_XXXXXX`);
    const path = f.path;
    await f.write(encoder.encode('hello world'));
    const st1 = await f.stat();
    assert.eq(st1.size, 11);
    await f.truncate(5);
    await f.close();
    const f2 = await open(path, 'r+');
    const buf = new Uint8Array(32);
    const nread = await f2.read(buf);
    const dataStr = decoder.decode(buf.subarray(0, nread));
    assert.eq(dataStr, 'hello');
    await f2.truncate();
    const st2 = await f2.stat();
    await f2.close();
    assert.eq(st2.size, 0);
    await tjs.unlink(path);
})();
