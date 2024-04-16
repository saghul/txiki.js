const core = globalThis[Symbol.for('tjs.internal.core')];
const sqlite3 = core._sqlite3;

const kSqlite3Handle = Symbol('kSqlite3Handle');

class Database {
    constructor(dbName = ':memory:', options = { create: true, readOnly: false }) {
        let flags = 0;

        if (options.create) {
            flags |= sqlite3.SQLITE_OPEN_CREATE;
        }

        if (options.readOnly) {
            flags |= sqlite3.SQLITE_OPEN_READONLY;
        } else {
            flags |= sqlite3.SQLITE_OPEN_READWRITE;
        }

        this[kSqlite3Handle] = sqlite3.open(dbName, flags);
    }

    close() {
        if (this[kSqlite3Handle]) {
            sqlite3.close(this[kSqlite3Handle]);
        }
    }

    prepare(sql) {
        if (!this[kSqlite3Handle]) {
            throw new Error('Invalid DB');
        }

        return new Statement(sqlite3.prepare(this[kSqlite3Handle], sql));
    }
}

const kSqlite3Stmt = Symbol('kSqlite3Stmt');

class Statement {
    constructor(stmt) {
        this[kSqlite3Stmt] = stmt;
    }

    finalize() {
        sqlite3.stmt_finalize(this[kSqlite3Stmt]);
    }

    toString() {
        return sqlite3.stmt_expand(this[kSqlite3Stmt]);
    }

    all(...args) {
        if (args && args.length === 1 && typeof args[0] === 'object') {
            args = args[0];
        }

        return sqlite3.stmt_all(this[kSqlite3Stmt], args);
    }

    run(...args) {
        if (args && args.length === 1 && typeof args[0] === 'object') {
            args = args[0];
        }

        sqlite3.stmt_run(this[kSqlite3Stmt], args);
    }
}


export { Database };
