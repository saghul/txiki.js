import express from '../txiki-express/index.js';
import { createDatabase } from '../txiki-orm/index.js';

// Initialize database
const db = createDatabase();

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
const alice = db.User.create({ name: 'Alice', email: 'alice@example.com' });
const bob = db.User.create({ name: 'Bob', email: 'bob@example.com' });

db.Post.create({ user_id: alice.id, title: 'Hello World', content: 'My first post' });
db.Post.create({ user_id: alice.id, title: 'Second Post', content: 'Another day' });
db.Post.create({ user_id: bob.id, title: 'Bob\'s Post', content: 'Bob writes here' });

console.log('Database initialized with sample data');

// Create Express app
const app = express();

// Middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to txiki.js with Express-lite and ORM!' });
});

app.get('/api/users', (req, res) => {
    const users = db.User.all();
    res.json({ users });
});

app.get('/api/users/:id', (req, res) => {
    const id = Number(req.params.id);
    const user = db.User.find(id);
    if (!user) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not found' }));
    } else {
        res.json({ user });
    }
});

app.get('/api/posts', (req, res) => {
    const posts = db.Post.all();
    res.json({ posts });
});

app.get('/api/users/:id/posts', (req, res) => {
    const id = Number(req.params.id);
    const posts = db.Post.findByUserId(id);
    res.json({ posts });
});

app.get('/api/search', (req, res) => {
    const query = req.query.q || '';
    const posts = db.Post.search(query);
    res.json({ posts, query });
});

// Start server
const PORT = 8000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Powered by @txiki/express and @txiki/orm');
});