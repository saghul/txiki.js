# @txiki/orm

Simple ORM for SQLite in txiki.js

## Installation

```bash
npm install @txiki/orm
```

## Usage

```javascript
import { createDatabase, User, Post } from '@txiki/orm';

const db = createDatabase(':memory:');

db.migrate(`
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
    );
`);

// Create records
const user = db.User.create({ name: 'Alice', email: 'alice@example.com' });

// Query records
const users = db.User.all();
const foundUser = db.User.find(1);
const userByEmail = db.User.findByEmail('alice@example.com');

// Update records
db.User.update(1, { name: 'Alice Updated' });

// Delete records
db.User.delete(1);

// Count records
const count = db.User.count();

// Transactions
db.transaction(() => {
    db.User.create({ name: 'Bob', email: 'bob@example.com' });
    db.Post.create({ user_id: 1, title: 'Hello' });
});

db.close();
```

## API

### createDatabase(dbName)

Create a new database connection.

### Model Methods

- `all()` - Get all records
- `find(id)` - Find record by ID
- `where(conditions)` - Find records by conditions
- `create(data)` - Create new record
- `update(id, data)` - Update record
- `delete(id)` - Delete record
- `count()` - Count records
- `query(sql, params)` - Execute custom query

## License

MIT