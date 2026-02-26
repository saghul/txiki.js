# @txiki/express

Express-lite framework for txiki.js

## Installation

```bash
npm install @txiki/express
```

## Usage

```javascript
import express from '@txiki/express';

const app = express();

// Middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Routes
app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/api/users/:id', (req, res) => {
    res.json({ id: req.params.id, name: `User ${req.params.id}` });
});

app.post('/api/data', (req, res) => {
    res.status(201).json({ success: true });
});

// Start server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
```

## API

### express()

Create a new Express application.

### Application Methods

- `use(middleware)` - Add middleware
- `get(path, ...handlers)` - GET route
- `post(path, ...handlers)` - POST route
- `put(path, ...handlers)` - PUT route
- `delete(path, ...handlers)` - DELETE route
- `patch(path, ...handlers)` - PATCH route
- `all(path, ...handlers)` - All methods route
- `listen(port, callback)` - Start server

### Request Methods

- `req.method` - HTTP method
- `req.url` - Request URL
- `req.headers` - Request headers
- `req.path` - URL pathname
- `req.query` - Query parameters
- `req.params` - Route parameters

### Response Methods

- `res.status(code)` - Set status code
- `res.send(body)` - Send response
- `res.json(obj)` - Send JSON response
- `res.writeHead(code, headers)` - Write headers
- `res.write(chunk)` - Write chunk
- `res.end(data)` - End response

## License

MIT