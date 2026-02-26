import express from 'tjs:express-lite';
import { Database } from 'tjs:sqlite';

// Initialize database
const db = new Database(':memory:');

db.migrate(`
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
`);

// Seed data
const existingUsers = db.exec('SELECT COUNT(*) as count FROM users')[0].count;
if (existingUsers === 0) {
    db.exec('INSERT INTO users (name, email) VALUES (?, ?)', ['Alice', 'alice@example.com']);
    db.exec('INSERT INTO users (name, email) VALUES (?, ?)', ['Bob', 'bob@example.com']);
    const aliceId = db.exec('SELECT last_insert_rowid() as id')[0].id;
    
    db.exec('INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)', [aliceId, 'Hello World', 'My first post']);
    db.exec('INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)', [aliceId, 'Second Post', 'Another day']);
    
    console.log('Database initialized with sample data');
}

const app = express();

app.get('/', (req, res) => {
    res.json({ message: 'Express + ORM Demo' });
});

app.get('/api/users', (req, res) => {
    const users = db.exec('SELECT id, name, email, created_at FROM users');
    res.json({ users });
});

app.get('/api/users/:id', (req, res) => {
    const user = db.exec('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.params.id]);
    if (user.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: user[0] });
});

app.get('/api/posts', (req, res) => {
    const posts = db.exec('SELECT id, user_id, title, content, created_at FROM posts');
    res.json({ posts });
});

app.get('/api/stats', (req, res) => {
    const userCount = db.exec('SELECT COUNT(*) as count FROM users')[0].count;
    const postCount = db.exec('SELECT COUNT(*) as count FROM posts')[0].count;
    res.json({ users: userCount, posts: postCount });
});

app.listen(8000, () => {
    console.log('Server running on http://localhost:8000');
});