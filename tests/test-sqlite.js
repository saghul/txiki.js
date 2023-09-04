import assert from 'tjs:assert';
import path from 'tjs:path';
import { Database } from 'tjs:sqlite';


function testTypes(dbName) {
    const db = new Database(dbName);

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
