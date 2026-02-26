import { createDatabase, User, Post } from '../txiki-orm/index.js';

class MCPServer {
    constructor(name, version) {
        this.name = name;
        this.version = version;
        this.tools = {};
        this.resources = {};
    }

    registerTool(name, description, handler) {
        this.tools[name] = { name, description, handler };
    }

    registerResource(uri, description, handler) {
        this.resources[uri] = { uri, description, handler };
    }

    async handleRequest(request) {
        const { method, params } = request;

        if (method === 'tools/list') {
            return {
                tools: Object.values(this.tools).map(t => ({
                    name: t.name,
                    description: t.description
                }))
            };
        }

        if (method === 'tools/call') {
            try {
                const { name, arguments: args = {} } = params;
                const tool = this.tools[name];
                if (!tool) {
                    throw new Error('Tool not found: ' + name);
                }
                return await tool.handler(args);
            } catch (error) {
                return { error: error.message };
            }
        }

        if (method === 'resources/list') {
            return {
                resources: Object.values(this.resources).map(r => ({
                    uri: r.uri,
                    description: r.description
                }))
            };
        }

        if (method === 'resources/read') {
            try {
                const { uri } = params;
                const resource = this.resources[uri];
                if (!resource) {
                    throw new Error('Resource not found: ' + uri);
                }
                return await resource.handler();
            } catch (error) {
                return { error: error.message };
            }
        }

        throw new Error('Unknown method: ' + method);
    }
}

function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

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

const existingUsers = db.User.all();
if (existingUsers.length === 0) {
    const alice = db.User.create({ name: 'Alice', email: 'alice@example.com' });
    const bob = db.User.create({ name: 'Bob', email: 'bob@example.com' });
    const charlie = db.User.create({ name: 'Charlie', email: 'charlie@example.com' });

    db.Post.create({ user_id: alice.id, title: 'Hello World', content: 'My first post' });
    db.Post.create({ user_id: alice.id, title: 'Introduction', content: 'Welcome to my blog' });
    db.Post.create({ user_id: bob.id, title: 'Tech Update', content: 'New features released' });
    db.Post.create({ user_id: bob.id, title: 'Code Review', content: 'Reviewing pull requests' });
    db.Post.create({ user_id: charlie.id, title: 'Design System', content: 'Building components' });

    console.log('Database initialized with sample data');
} else {
    console.log('Database already contains data, skipping initialization');
}

const mcp = new MCPServer('express-orm-demo', '1.0.0');

mcp.registerTool('list_users', 'List all users in the database', async () => {
    const users = db.User.all();
    return { users };
});

mcp.registerTool('get_user', 'Get a specific user by ID', async (args) => {
    const user = db.User.find(args.id);
    if (!user) {
        throw new Error('User not found: ' + args.id);
    }
    return { user };
});

mcp.registerTool('find_user_by_email', 'Find a user by email address', async (args) => {
    if (!args.email || !validateEmail(args.email)) {
        throw new Error('Invalid email format');
    }
    const user = db.User.findByEmail(args.email);
    if (!user) {
        throw new Error('User not found: ' + args.email);
    }
    return { user };
});

mcp.registerTool('create_user', 'Create a new user', async (args) => {
    if (!args.name || typeof args.name !== 'string' || args.name.trim() === '') {
        throw new Error('Invalid or missing name parameter');
    }
    if (!args.email || !validateEmail(args.email)) {
        throw new Error('Invalid email format');
    }
    const user = db.User.create({ name: args.name.trim(), email: args.email.trim() });
    return { user };
});

mcp.registerTool('update_user', 'Update an existing user', async (args) => {
    const user = db.User.update(args.id, args.updates);
    return { user };
});

mcp.registerTool('delete_user', 'Delete a user', async (args) => {
    db.User.delete(args.id);
    return { success: true, deletedId: args.id };
});

mcp.registerTool('list_posts', 'List all posts', async () => {
    const posts = db.Post.all();
    return { posts };
});

mcp.registerTool('get_post', 'Get a specific post by ID', async (args) => {
    const post = db.Post.find(args.id);
    if (!post) {
        throw new Error('Post not found: ' + args.id);
    }
    return { post };
});

mcp.registerTool('get_user_posts', 'Get all posts by a specific user', async (args) => {
    const posts = db.Post.findByUserId(args.userId);
    return { posts };
});

mcp.registerTool('search_posts', 'Search posts by keyword', async (args) => {
    const posts = db.Post.search(args.query);
    return { posts, query: args.query };
});

mcp.registerTool('create_post', 'Create a new post', async (args) => {
    const post = db.Post.create({ user_id: args.user_id, title: args.title, content: args.content || '' });
    return { post };
});

mcp.registerTool('get_stats', 'Get database statistics', async () => {
    const userCount = db.User.count();
    const postCount = db.Post.count();
    return { users: userCount, posts: postCount, total: userCount + postCount };
});

mcp.registerResource('users://all', 'All users in the database', async () => {
    const users = db.User.all();
    return { uri: 'users://all', data: users };
});

mcp.registerResource('posts://all', 'All posts in the database', async () => {
    const posts = db.Post.all();
    return { uri: 'posts://all', data: posts };
});

mcp.registerResource('stats://overview', 'Database overview statistics', async () => {
    const userCount = db.User.count();
    const postCount = db.Post.count();
    return { uri: 'stats://overview', data: { users: userCount, posts: postCount, total: userCount + postCount } };
});

export default {
    name: 'txiki-mcp-server',
    version: '1.0.0',
    
    async fetch(request) {
        const url = new URL(request.url);
        const path = url.pathname;

        if (path === '/') {
            return new Response(JSON.stringify({
                name: mcp.name,
                version: mcp.version,
                description: 'MCP Server for Express + ORM Demo',
                endpoints: {
                    'POST /mcp': 'Execute MCP request',
                    'GET /tools': 'List available tools',
                    'GET /resources': 'List available resources'
                }
            }), {
                headers: { 'content-type': 'application/json' }
            });
        }

        if (path === '/tools') {
            return new Response(JSON.stringify(await mcp.handleRequest({
                method: 'tools/list',
                params: {}
            })), {
                headers: { 'content-type': 'application/json' }
            });
        }

        if (path === '/resources') {
            return new Response(JSON.stringify(await mcp.handleRequest({
                method: 'resources/list',
                params: {}
            })), {
                headers: { 'content-type': 'application/json' }
            });
        }

        if (path === '/mcp' && request.method === 'POST') {
            try {
                const body = await request.text();
                const mcpRequest = JSON.parse(body);
                const result = await mcp.handleRequest(mcpRequest);
                return new Response(JSON.stringify(result), {
                    headers: { 'content-type': 'application/json' }
                });
            } catch (error) {
                if (error instanceof SyntaxError) {
                    return new Response(JSON.stringify({ 
                        error: 'Invalid JSON', 
                        message: error.message 
                    }), {
                        status: 400,
                        headers: { 'content-type': 'application/json' }
                    });
                }
                return new Response(JSON.stringify({ 
                    error: 'Internal server error', 
                    message: error.message 
                }), {
                    status: 500,
                    headers: { 'content-type': 'application/json' }
                });
            }
        }

        return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: { 'content-type': 'application/json' }
        });
    }
};