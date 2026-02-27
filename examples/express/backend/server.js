import express from 'tjs:express-lite';

const app = express();

let users = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
    { id: 3, name: 'Charlie', email: 'charlie@example.com' }
];

let posts = [
    { id: 1, userId: 1, title: 'Hello World', content: 'My first post' },
    { id: 2, userId: 1, title: 'Introduction', content: 'Welcome to my blog' },
    { id: 3, userId: 2, title: 'Tech Update', content: 'New features released' }
];

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

app.get('/api/users', (req, res) => {
    res.json({ users });
});

app.get('/api/users/:id', (req, res) => {
    const user = users.find(u => u.id === parseInt(req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
});

app.get('/api/posts', (req, res) => {
    res.json({ posts });
});

app.get('/api/stats', (req, res) => {
    res.json({ users: users.length, posts: posts.length });
});

app.listen(8080, () => {
    console.log('Server running on http://localhost:8080');
});
