import core from 'tjs:internal/core';
const sqlite3 = core.sqlite3;

let controllers;

class Database {
    #handle;

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

        this.#handle = sqlite3.open(dbName, flags);
    }

    close() {
        if (this.#handle) {
            sqlite3.close(this.#handle);
            this.#handle = null;
        }
    }

    [Symbol.dispose]() {
        this.close();
    }

    exec(sql) {
        if (!this.#handle) {
            throw new Error('Invalid DB');
        }

        sqlite3.exec(this.#handle, sql);
    }

    prepare(sql) {
        if (!this.#handle) {
            throw new Error('Invalid DB');
        }

        return new Statement(sqlite3.prepare(this.#handle, sql));
    }

    // Code for transactions is largely copied from better-sqlite3 and Bun
    // https://github.com/JoshuaWise/better-sqlite3/blob/master/lib/methods/transaction.js
    // https://github.com/oven-sh/bun/blob/main/src/js/bun/sqlite.ts

    get inTransaction() {
        if (!this.#handle) {
            return false;
        }

        return sqlite3.in_transaction(this.#handle);
    }

    transaction(fn) {
        if (typeof fn !== 'function') {
            throw new TypeError('Expected first argument to be a function');
        }

        const db = this;
        const controller = getController(db);

        // Each version of the transaction function has these same properties.
        const properties = {
            default: { value: wrapTransaction(fn, db, controller.default) },
            deferred: { value: wrapTransaction(fn, db, controller.deferred) },
            immediate: { value: wrapTransaction(fn, db, controller.immediate) },
            exclusive: { value: wrapTransaction(fn, db, controller.exclusive) },
        };

        Object.defineProperties(properties.default.value, properties);
        Object.defineProperties(properties.deferred.value, properties);
        Object.defineProperties(properties.immediate.value, properties);
        Object.defineProperties(properties.exclusive.value, properties);

        // Return the default version of the transaction function.
        return properties.default.value;
    }

    loadExtension(file, entrypoint=undefined) {
        return sqlite3.load_extension(this.#handle,file,entrypoint);
    }
}

// Return the database's cached transaction controller, or create a new one.
const getController = db => {
    let controller = (controllers ||= new WeakMap()).get(db);

    if (!controller) {
        const shared = {
            commit: db.prepare('COMMIT'),
            rollback: db.prepare('ROLLBACK'),
            savepoint: db.prepare('SAVEPOINT `\t_bs3.\t`'),
            release: db.prepare('RELEASE `\t_bs3.\t`'),
            rollbackTo: db.prepare('ROLLBACK TO `\t_bs3.\t`'),
        };

        controller = {
            default: Object.assign({ begin: db.prepare('BEGIN') }, shared),
            deferred: Object.assign({ begin: db.prepare('BEGIN DEFERRED') }, shared),
            immediate: Object.assign({ begin: db.prepare('BEGIN IMMEDIATE') }, shared),
            exclusive: Object.assign({ begin: db.prepare('BEGIN EXCLUSIVE') }, shared),
        };

        controllers.set(db, controller);
    }

    return controller;
};

// Return a new transaction function by wrapping the given function.
const wrapTransaction = (fn, db, { begin, commit, rollback, savepoint, release, rollbackTo }) =>
    function transaction() {
        let before, after, undo;

        if (db.inTransaction) {
            before = savepoint;
            after = release;
            undo = rollbackTo;
        } else {
            before = begin;
            after = commit;
            undo = rollback;
        }

        try {
            before.run();

            const result = Function.prototype.apply.call(fn, this, arguments);

            after.run();

            return result;
        } catch (ex) {
            if (db.inTransaction) {
                undo.run();

                if (undo !== rollback) {
                    after.run();
                }
            }

            throw ex;
        }
    };

class Statement {
    #stmt;

    constructor(stmt) {
        this.#stmt = stmt;
    }

    finalize() {
        sqlite3.stmt_finalize(this.#stmt);
    }

    [Symbol.dispose]() {
        this.finalize();
    }

    toString() {
        return sqlite3.stmt_expand(this.#stmt);
    }

    all(...args) {
        if (args && args.length === 1 && typeof args[0] === 'object') {
            args = args[0];
        }

        return sqlite3.stmt_all(this.#stmt, args);
    }

    run(...args) {
        if (args && args.length === 1 && typeof args[0] === 'object') {
            args = args[0];
        }

        sqlite3.stmt_run(this.#stmt, args);
    }
}


export { Database };
