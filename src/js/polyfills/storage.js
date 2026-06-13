/* global tjs */
import core from 'tjs:internal/core';
import path from 'tjs:internal/path';

const sqlite3 = core.sqlite3;

class Storage {
    #map = new Map();

    getItem(key) {
        const stringKey = String(key);

        if (this.#map.has(key)) {
            return this.#map.get(stringKey);
        }

        return null;
    }

    setItem(key, val) {
        this.#map.set(String(key), String(val));
    }

    removeItem(key) {
        this.#map.delete(String(key));
    }

    clear() {
        this.#map.clear();
    }

    key(i) {
        if (typeof i === 'undefined') {
            throw new TypeError('Failed to execute \'key\' on \'Storage\': 1 argument required, but only 0 present.');
        }

        const keys = Array.from(this.#map.keys());

        return keys[i];
    }

    get length() {
        return this.#map.size;
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


function initDb() {
    const TJS_HOME = tjs.env.TJS_HOME ?? path.join(tjs.homeDir, '.tjs');
    const localStorageDb = path.join(TJS_HOME, 'localStorage.db');
    const flags = sqlite3.SQLITE_OPEN_CREATE | sqlite3.SQLITE_OPEN_READWRITE;

    let db;

    try {
        db = sqlite3.open(localStorageDb, flags);
    } catch (_e) {
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
    #db;

    constructor() {
        super();

        const db = this.#db = initDb();

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
            super.setItem(item.key, item.value);
        }
    }

    setItem(key, val) {
        super.setItem(key, val);

        const db = this.#db;

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

        const db = this.#db;

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

        const db = this.#db;

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
            // Persistence is backed by SQLite; on builds without it (BUILD_WITH_SQLITE=OFF)
            // fall back to an in-memory store so localStorage stays usable (non-persistent).
            const storage = sqlite3 ? new PersistentStorage() : new Storage();

            _localStorage = new Proxy(storage, storageProxyHandler);
        }

        return _localStorage;
    }
});
