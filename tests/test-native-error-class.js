import assert from 'tjs:assert';
import { dlopen } from 'tjs:ffi';
import { Database } from 'tjs:sqlite';

// Native failures must throw a plain, catchable Error: quickjs-ng makes
// InternalError uncatchable, reserving it for an engine in a bad state.
function catchError(fn) {
    try {
        fn();
    } catch (e) {
        return e;
    }

    assert.fail('expected an error to be thrown');
}

{
    const db = new Database(':memory:');
    const stmt = db.prepare('SELECT 1');

    stmt.finalize();

    const e = catchError(() => stmt.run());

    assert.ok(e instanceof Error);
    assert.eq(e.name, 'Error');
    assert.eq(e.message, 'Statement has been finalized');
    db.close();
}

{
    const e = catchError(() => dlopen('definitely-not-a-library', {}));

    assert.ok(e instanceof Error);
    assert.eq(e.name, 'Error');
}
