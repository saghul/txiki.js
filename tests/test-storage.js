import assert from 'tjs:assert';
import path from 'tjs:path';


if (tjs.env.TJS_HOME) {
    // This is the second test.
    assert.eq(globalThis.localStorage.getItem('foo'), '123');

    tjs.exit(0);
}

globalThis.localStorage.clear();

assert.eq(globalThis.localStorage.getItem('foo'), null);

globalThis.localStorage.setItem('foo', 123);

assert.eq(globalThis.localStorage.getItem('foo'), '123');

const args = [
    tjs.exePath,
    'run',
    import.meta.path
];
const proc = tjs.spawn(args, { env: { TJS_HOME: path.join(import.meta.dirname, 'fixtures') } });
const status = await proc.wait();

assert.ok(status.exit_status === 0 && status.term_signal === null, 'succeeded')
