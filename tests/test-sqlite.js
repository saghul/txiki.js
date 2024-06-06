import assert from 'tjs:assert';
import path from 'tjs:path';
import { Database } from 'tjs:sqlite';


function testTypes(dbName) {
    const db = new Database(dbName);

    db.exec('PRAGMA journal_mode = WAL;');

    db.prepare('CREATE TABLE test (txt TEXT NOT NULL, int INTEGER, double FLOAT, data BLOB)').run();
    
    const ins = db.prepare('INSERT INTO test (txt, int, double, data) VALUES(?, ?, ?, ?)');
    
    ins.run('foo', 42, 4.2, new Uint8Array(16).fill(42));
    ins.run('foo', 43, 4.3, new Uint8Array(16).fill(43));
    ins.run('bar', 69, 6.9, new Uint8Array(16).fill(69));
    ins.run('baz', 666, 6.6, null);
    
    ins.finalize();

    assert.throws(() => ins.run('baz', 666, 6.6, null), InternalError);

    const data1 = db.prepare('SELECT * FROM test').all();
    const data2 = db.prepare('SELECT * FROM test WHERE txt = $txt').all({ $txt: 'foo' });

    assert.throws(() => db.prepare('SELECT * FROM test WHERE txt = $txt').all({ txt: 'foo' }), ReferenceError);
    assert.eq(data1.length, 4);
    assert.eq(data2.length, 2);

    assert.eq(data1[0].txt, 'foo');
    assert.eq(data1[0].int, 42);
    assert.eq(data1[0].double, 4.2);
    assert.eq(data1[0].data[0], 42);

    assert.eq(data1[3].txt, 'baz');
    assert.eq(data1[3].data, null);

    assert.throws(() => db.prepare('INSERT INTO test (txt, int, double, data) VALUES(?, ?, ?, ?)').run(null, 42, 4.2, null), Error);

    db.close();
}

function testExistingDB() {
    const db = new Database(path.join(import.meta.dirname, 'fixtures', 'test.sqlite'), { readOnly: true });

    const data1 = db.prepare('SELECT * FROM test').all();
    const data2 = db.prepare('SELECT * FROM test WHERE txt = $txt').all({ $txt: 'foo' });

    assert.eq(data1.length, 4);
    assert.eq(data2.length, 2);

    assert.eq(data1[0].txt, 'foo');
    assert.eq(data1[0].int, 42);
    assert.eq(data1[0].double, 4.2);
    assert.eq(data1[0].data[0], 42);

    assert.eq(data1[3].txt, 'baz');
    assert.eq(data1[3].data, null);

    assert.throws(() => db.prepare('INSERT INTO test (txt, int, double, data) VALUES(?, ?, ?, ?)').run('foo', 42, 4.2, null), Error);

    db.close();
}

function testNewDbNoCreate() {
    assert.throws(() => new Database(path.join(import.meta.dirname, 'fixtures', 'nope.sqlite'), { create: false }), Error);

}

testTypes();
testExistingDB();

const newDb = path.join(import.meta.dirname, `db-${tjs.pid}.sqlite`);

testTypes(newDb);

const result = await tjs.stat(newDb);

assert.ok(result.isFile, 'file was created ok');

await tjs.unlink(newDb);

testNewDbNoCreate();

function testTransactions() {
    const db = new Database();

    assert.falsy(db.inTransaction);

    db.exec('CREATE TABLE test (txt TEXT NOT NULL, int INTEGER, double FLOAT, data BLOB)');

    const ins = db.prepare('INSERT INTO test (txt, int, double, data) VALUES(?, ?, ?, ?)');
    const insMany = db.transaction(datas => {
        assert.ok(db.inTransaction);

        for (const data of datas) {
            ins.run(data);
        }
    });

    insMany([
        [ 'foo', 42, 4.2, new Uint8Array(16).fill(42) ],
        [ 'foo', 43, 4.3, new Uint8Array(16).fill(43) ],
        [ 'bar', 69, 6.9, new Uint8Array(16).fill(69) ],
        [ 'baz', 666, 6.6, null ],
    ]);

    const data1 = db.prepare('SELECT * FROM test').all();

    assert.eq(data1.length, 4);
}

function testTransactionsError() {
    const db = new Database();

    assert.falsy(db.inTransaction);

    db.exec('CREATE TABLE test (txt TEXT NOT NULL, int INTEGER, double FLOAT, data BLOB)');

    const ins = db.prepare('INSERT INTO test (txt, int, double, data) VALUES(?, ?, ?, ?)');
    const insMany = db.transaction(datas => {
        assert.ok(db.inTransaction);

        for (const data of datas) {
            ins.run(data);
        }

        throw new Error('oops!');
    });

    assert.throws(() => insMany([
        [ 'foo', 42, 4.2, new Uint8Array(16).fill(42) ],
        [ 'foo', 43, 4.3, new Uint8Array(16).fill(43) ],
        [ 'bar', 69, 6.9, new Uint8Array(16).fill(69) ],
        [ 'baz', 666, 6.6, null ],
    ]), Error, 'an error is thrown');

    const data1 = db.prepare('SELECT * FROM test').all();

    assert.falsy(db.inTransaction);
    assert.eq(data1.length, 0);
}

function testTransactionsNested() {
    const db = new Database();

    assert.falsy(db.inTransaction);

    db.exec('CREATE TABLE test (txt TEXT NOT NULL, int INTEGER, double FLOAT, data BLOB)');

    const ins = db.prepare('INSERT INTO test (txt, int, double, data) VALUES(?, ?, ?, ?)');
    const ins2 = db.prepare('INSERT INTO test (txt, int) VALUES(?, ?)');

    const insMany = db.transaction(datas => {
        assert.ok(db.inTransaction);

        for (const data of datas) {
            ins.run(data);
        }

        throw new Error('oops!');
    });

    const insMany2 = db.transaction(datas => {
        assert.ok(db.inTransaction);

        for (const data of datas) {
            ins.run(data);
        }

        try {
            insMany([
                [ 'foo', 42, 4.2, new Uint8Array(16).fill(42) ],
                [ 'foo', 43, 4.3, new Uint8Array(16).fill(43) ],
                [ 'bar', 69, 6.9, new Uint8Array(16).fill(69) ],
                [ 'baz', 666, 6.6, null ]
            ]);
        } catch(_) {
            // Ignore, so the outer transaction succeeds.
        }
    });

    insMany2([
        [ '1234', 1234 ],
        [ '4321', 4321 ],
    ]);

    const data1 = db.prepare('SELECT * FROM test').all();

    assert.falsy(db.inTransaction);
    assert.eq(data1.length, 2);
}

testTransactions();
testTransactionsError();
testTransactionsNested()
