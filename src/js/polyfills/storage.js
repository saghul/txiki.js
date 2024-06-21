/* global tjs */

const core = globalThis[Symbol.for('tjs.internal.core')];
const sqlite3 = core._sqlite3;

const kStorageMap = Symbol('kStorageMap');

class Storage {
    constructor() {
        this[kStorageMap] = new Map();
    }

    getItem(key) {
        const stringKey = String(key);

        if (this[kStorageMap].has(key)) {
            return this[kStorageMap].get(stringKey);
        }

        return null;
    }

    setItem(key, val) {
        this[kStorageMap].set(String(key), String(val));
    }

    removeItem(key) {
        this[kStorageMap].delete(String(key));
    }

    clear() {
        this[kStorageMap].clear();
    }

    key(i) {
        if (typeof i === 'undefined') {
            throw new TypeError('Failed to execute \'key\' on \'Storage\': 1 argument required, but only 0 present.');
        }

        const keys = Array.from(this[kStorageMap].keys());

        return keys[i];
    }

    get length() {
        return this[kStorageMap].size;
    }

    get [Symbol.toStringTag]() {
        return 'Storage';
    }
}

const storageProxyHandler = {
    set: function (target, prop, value) {
        target.setItem(prop, value);

        return true;
    },
    get: function (target, prop) {
        if (prop in Storage.prototype) {
            if (typeof target[prop] === 'function') {
                return (...args) => target[prop].apply(target, args);
            }

            return target[prop];
        }

        return target.getItem(prop);
    }
};

let _sessionStorage;

Object.defineProperty(globalThis, 'sessionStorage', {
    enumerable: true,
    configurable: true,
    get: () => {
        if (!_sessionStorage) {
            _sessionStorage = new Proxy(new Storage(), storageProxyHandler);
        }

        return _sessionStorage;
    }
});

const kStorageDb = Symbol('kStorageDb');


function initDb() {
    const path = globalThis[Symbol.for('tjs.internal.modules.path')];

    const TJS_HOME = tjs.env.TJS_HOME ?? path.join(tjs.homedir(), '.tjs');
    const localStorageDb = path.join(TJS_HOME, 'localStorage.db');
    const flags = sqlite3.SQLITE_OPEN_CREATE | sqlite3.SQLITE_OPEN_READWRITE;

    try {
        mkdirSync(path.dirname(localStorageDb), { recursive: true });
    } catch (e) {
        // Ignore.
    }

    let db;

    try {
        db = sqlite3.open(localStorageDb, flags);
    } catch (e) {
        // Ignore.

        return;
    }

    try {
        const stmt = sqlite3.prepare(db,
            'CREATE TABLE IF NOT EXISTS kv (key TEXT NOT NULL UNIQUE, value TEXT NOT NULL)');

        sqlite3.stmt_run(stmt);
        sqlite3.stmt_finalize(stmt);
    } catch (_) {
        db.close();
        db = null;
    }

    return db;
}

class PersistentStorage extends Storage {
    constructor() {
        super();

        const db = this[kStorageDb] = initDb();

        /* Load existing values. */
        const stmt = sqlite3.prepare(db, 'SELECT * from kv');
        let r = [];

        try {
            r = sqlite3.stmt_all(stmt);
        } catch (_) {
            // Ignore.
        }

        sqlite3.stmt_finalize(stmt);

        for (const item of r) {
            this[kStorageMap].set(item.key, item.value);
        }
    }

    setItem(key, val) {
        super.setItem(key, val);

        const db = this[kStorageDb];

        if (db) {
            const stmt = sqlite3.prepare(db, 'INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)');

            try {
                sqlite3.stmt_run(stmt, [ String(key), String(val) ]);
            } catch (_) {
                // Ignore.
            }

            sqlite3.stmt_finalize(stmt);
        }
    }

    removeItem(key) {
        super.removeItem(key);

        const db = this[kStorageDb];

        if (db) {
            const stmt = sqlite3.prepare(db, 'DELETE FROM kv WHERE key = ?');

            try {
                sqlite3.stmt_run(stmt, [ String(key) ]);
            } catch (_) {
                // Ignore.
            }

            sqlite3.stmt_finalize(stmt);
        }
    }

    clear() {
        super.clear();

        const db = this[kStorageDb];

        if (db) {
            const stmt = sqlite3.prepare(db, 'DELETE FROM kv');

            try {
                sqlite3.stmt_run(stmt);
            } catch (_) {
                // Ignore.
            }

            sqlite3.stmt_finalize(stmt);
        }
    }
}

let _localStorage;

Object.defineProperty(globalThis, 'localStorage', {
    enumerable: true,
    configurable: true,
    get: () => {
        if (!_localStorage) {
            _localStorage = new Proxy(new PersistentStorage(), storageProxyHandler);
        }

        return _localStorage;
    }
});

function mkdirSync(path, options = { mode: 0o777, recursive: false }) {
    const pathModule = globalThis[Symbol.for('tjs.internal.modules.path')];

    if (!options.recursive) {
        return core._mkdirSync(path, options.mode);
    }

    const parent = pathModule.dirname(path);

    if (parent === path) {
        return;
    }

    mkdirSync(parent, options);

    try {
        return core._mkdirSync(path, options.mode);
    } catch (e) {
        // Cannot rely on checking for EEXIST since the OS could throw other errors like EROFS.

        const st = core._statSync(path);

        if (!st.isDirectory) {
            throw e;
        }
    }
}
