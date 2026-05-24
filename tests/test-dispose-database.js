import assert from 'tjs:assert';
import { Database } from 'tjs:sqlite';


function testBasicDispose() {
    let dbRef;

    {
        using db = new Database(':memory:');

        db.exec('CREATE TABLE t (v INTEGER)');
        db.prepare('INSERT INTO t (v) VALUES (?)').run(42);
        assert.eq(db.prepare('SELECT * FROM t').all()[0].v, 42);

        dbRef = db;
    }

    // After scope exit, the database is closed: exec should throw.
    assert.throws(() => dbRef.exec('SELECT 1'), Error, 'closed db throws on exec');
    assert.throws(() => dbRef.prepare('SELECT 1'), Error, 'closed db throws on prepare');
}

function testManualCloseThenDispose() {
    let dbRef;

    {
        using db = new Database(':memory:');

        db.exec('CREATE TABLE t (v INTEGER)');
        db.close(); // explicit close before scope exit
        dbRef = db;
    }

    // Disposing after a manual close should be a no-op (idempotent).
    assert.throws(() => dbRef.exec('SELECT 1'), Error, 'still closed');
}

function testDisposeSymbolPresent() {
    const db = new Database(':memory:');

    assert.eq(typeof db[Symbol.dispose], 'function');

    // Class methods are non-enumerable.
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(db), Symbol.dispose);

    assert.ok(descriptor);
    assert.eq(descriptor.enumerable, false);
    assert.eq(descriptor.writable, true);
    assert.eq(descriptor.configurable, true);

    db.close();
}

testBasicDispose();
testManualCloseThenDispose();
testDisposeSymbolPresent();
