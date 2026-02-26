// Simple ORM for SQLite in txiki.js
import { Database } from 'tjs:sqlite';

class Model {
    constructor(db, tableName) {
        this.db = db;
        this.tableName = tableName;
    }

    all() {
        const stmt = this.db.prepare(`SELECT * FROM ${this.tableName}`);
        const results = stmt.all();
        stmt.finalize();
        return results;
    }

    find(id) {
        const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
        const results = stmt.all(id);
        stmt.finalize();
        return results.length > 0 ? results[0] : null;
    }

    where(conditions) {
        const keys = Object.keys(conditions);
        const values = Object.values(conditions);
        const whereClause = keys.map(k => `${k} = ?`).join(' AND ');
        const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${whereClause}`);
        const results = stmt.all(...values);
        stmt.finalize();
        return results;
    }

    create(data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?').join(', ');
        const stmt = this.db.prepare(`INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`);
        stmt.run(...values);
        stmt.finalize();
        
        // Get the last inserted ID
        const idStmt = this.db.prepare(`SELECT last_insert_rowid() as id`);
        const result = idStmt.all()[0];
        idStmt.finalize();
        
        return this.find(result.id);
    }

    update(id, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const stmt = this.db.prepare(`UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`);
        stmt.run(...values, id);
        stmt.finalize();
        return this.find(id);
    }

    delete(id) {
        const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
        stmt.run(id);
        stmt.finalize();
    }

    count() {
        const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`);
        const result = stmt.all()[0];
        stmt.finalize();
        return result.count;
    }

    query(sql, params = []) {
        const stmt = this.db.prepare(sql);
        const results = stmt.all(...params);
        stmt.finalize();
        return results;
    }
}

class User extends Model {
    constructor(db) {
        super(db, 'users');
    }

    findByEmail(email) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
        const results = stmt.all(email);
        stmt.finalize();
        return results.length > 0 ? results[0] : null;
    }

    withPosts() {
        const stmt = this.db.prepare(`
            SELECT users.*, COUNT(posts.id) as post_count 
            FROM users 
            LEFT JOIN posts ON users.id = posts.user_id 
            GROUP BY users.id
        `);
        const results = stmt.all();
        stmt.finalize();
        return results;
    }
}

class Post extends Model {
    constructor(db) {
        super(db, 'posts');
    }

    findByUserId(userId) {
        const stmt = this.db.prepare('SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC');
        const results = stmt.all(userId);
        stmt.finalize();
        return results;
    }

    search(keyword) {
        const stmt = this.db.prepare('SELECT * FROM posts WHERE title LIKE ? OR content LIKE ?');
        const results = stmt.all(`%${keyword}%`, `%${keyword}%`);
        stmt.finalize();
        return results;
    }
}

export function createDatabase(dbName = ':memory:') {
    const db = new Database(dbName);
    
    return {
        db,
        User: new User(db),
        Post: new Post(db),
        
        migrate(schema) {
            db.exec(schema);
        },
        
        transaction(fn) {
            db.exec('BEGIN TRANSACTION');
            try {
                fn();
                db.exec('COMMIT');
            } catch (err) {
                db.exec('ROLLBACK');
                throw err;
            }
        },
        
        close() {
            db.close();
        }
    };
}

export { Model, User, Post };