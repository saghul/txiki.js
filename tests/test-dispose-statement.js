import assert from 'tjs:assert';
import { Database } from 'tjs:sqlite';


function testBasicDispose() {
    const db = new Database(':memory:');

    db.exec('CREATE TABLE t (v INTEGER)');
    db.exec('INSERT INTO t (v) VALUES (1), (2), (3)');

    let stmtRef;

    {
        using stmt = db.prepare('SELECT * FROM t');

        const rows = stmt.all();

        assert.eq(rows.length, 3);
        stmtRef = stmt;
    }

    // After scope, statement was finalized. Calling .all() / .run() should throw.
    assert.throws(() => stmtRef.all(), InternalError, 'finalized stmt throws on all');
    assert.throws(() => stmtRef.run(), InternalError, 'finalized stmt throws on run');

    db.close();
}

function testManualFinalizeThenDispose() {
    const db = new Database(':memory:');

    db.exec('CREATE TABLE t (v INTEGER)');

    let stmtRef;

    {
        using stmt = db.prepare('INSERT INTO t (v) VALUES (?)');

        stmt.run(7);
        stmt.finalize(); // explicit finalize before scope exit
        stmtRef = stmt;
    }

    // Dispose after manual finalize must be a no-op (idempotent).
    assert.throws(() => stmtRef.run(8), InternalError);
    db.close();
}

function testDoubleFinalize() {
    const db = new Database(':memory:');

    db.exec('CREATE TABLE t (v INTEGER)');

    const stmt = db.prepare('SELECT * FROM t');

    stmt.finalize();
    stmt.finalize(); // second call must be a no-op (idempotent)
    db.close();
}

function testDisposeAfterUsingScope() {
    const db = new Database(':memory:');

    db.exec('CREATE TABLE t (v INTEGER)');

    let stmtRef;

    {
        using stmt = db.prepare('SELECT * FROM t');

        stmtRef = stmt;
    }

    // Manual finalize after `using` scope should be a no-op (already finalized).
    stmtRef.finalize();
    db.close();
}

function testDisposeSymbolPresent() {
    const db = new Database(':memory:');

    db.exec('CREATE TABLE t (v INTEGER)');

    const stmt = db.prepare('SELECT * FROM t');

    assert.eq(typeof stmt[Symbol.dispose], 'function');

    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(stmt), Symbol.dispose);

    assert.ok(descriptor);
    assert.eq(descriptor.enumerable, false);
    assert.eq(descriptor.writable, true);
    assert.eq(descriptor.configurable, true);

    stmt.finalize();
    db.close();
}

testBasicDispose();
testManualFinalizeThenDispose();
testDoubleFinalize();
testDisposeAfterUsingScope();
testDisposeSymbolPresent();
