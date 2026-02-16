import assert from 'tjs:assert';
import { Hono, stream, streamSSE } from './generated/hono.js';


const app = new Hono();

// Middleware: add x-powered-by header to all responses.
app.use('*', async (c, next) => {
    await next();
    c.header('x-powered-by', 'tjs+hono');
});

// Basic text response.
app.get('/', (c) => c.text('hello from hono'));

// JSON response.
app.get('/json', (c) => c.json({ message: 'hello', number: 42 }));

// Route params.
app.get('/users/:id', (c) => {
    const id = c.req.param('id');

    return c.json({ userId: id });
});

// POST with JSON body.
app.post('/echo', async (c) => {
    const body = await c.req.json();

    return c.json({ received: body });
});

// Custom status.
app.get('/not-found', (c) => c.text('gone', 404));

// Streaming response.
app.get('/stream', (c) => {
    return stream(c, async (s) => {
        await s.write('chunk1\n');
        await s.write('chunk2\n');
        await s.write('chunk3\n');
    });
});

// Server-Sent Events.
app.get('/sse', (c) => {
    return streamSSE(c, async (s) => {
        await s.writeSSE({ data: 'hello', event: 'greeting', id: '1' });
        await s.writeSSE({ data: 'world', event: 'greeting', id: '2' });
    });
});

// Grouped routes.
const api = new Hono();
api.get('/status', (c) => c.json({ ok: true }));
api.get('/version', (c) => c.json({ version: '1.0.0' }));
app.route('/api', api);


// --- Start server ---

const server = tjs.serve({ port: 0, fetch: app.fetch });
const base = `http://127.0.0.1:${server.port}`;


// Test: basic text response with middleware header.
async function testBasicText() {
    const resp = await fetch(`${base}/`);
    assert.eq(resp.status, 200, 'status is 200');
    assert.eq(resp.headers.get('x-powered-by'), 'tjs+hono', 'middleware header');

    const text = await resp.text();
    assert.eq(text, 'hello from hono', 'body matches');
}

// Test: JSON response.
async function testJSON() {
    const resp = await fetch(`${base}/json`);
    assert.eq(resp.status, 200, 'status is 200');
    assert.ok(resp.headers.get('content-type').includes('application/json'), 'content-type');

    const json = await resp.json();
    assert.eq(json.message, 'hello', 'message field');
    assert.eq(json.number, 42, 'number field');
}

// Test: route params.
async function testRouteParams() {
    const resp = await fetch(`${base}/users/123`);
    const json = await resp.json();
    assert.eq(json.userId, '123', 'userId param');
}

// Test: POST with JSON body.
async function testPostJSON() {
    const resp = await fetch(`${base}/echo`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ foo: 'bar' }),
    });
    assert.eq(resp.status, 200, 'status is 200');

    const json = await resp.json();
    assert.eq(json.received.foo, 'bar', 'echoed body');
}

// Test: custom status code.
async function testCustomStatus() {
    const resp = await fetch(`${base}/not-found`);
    assert.eq(resp.status, 404, 'status is 404');
    assert.eq(await resp.text(), 'gone', 'body matches');
}

// Test: 404 for unknown route.
async function testNotFound() {
    const resp = await fetch(`${base}/does-not-exist`);
    assert.eq(resp.status, 404, 'status is 404');
}

// Test: streaming response.
async function testStreaming() {
    const resp = await fetch(`${base}/stream`);
    assert.eq(resp.status, 200, 'status is 200');

    const text = await resp.text();
    assert.eq(text, 'chunk1\nchunk2\nchunk3\n', 'all chunks received');
}

// Test: Server-Sent Events.
async function testSSE() {
    const resp = await fetch(`${base}/sse`);
    assert.eq(resp.status, 200, 'status is 200');
    assert.ok(
        resp.headers.get('content-type').includes('text/event-stream'),
        'content-type is text/event-stream',
    );

    const text = await resp.text();
    assert.ok(text.includes('event: greeting'), 'has event field');
    assert.ok(text.includes('data: hello'), 'has first data');
    assert.ok(text.includes('data: world'), 'has second data');
    assert.ok(text.includes('id: 1'), 'has first id');
    assert.ok(text.includes('id: 2'), 'has second id');
}

// Test: grouped routes.
async function testGroupedRoutes() {
    const r1 = await fetch(`${base}/api/status`);
    assert.eq(r1.status, 200, 'status endpoint');
    assert.eq((await r1.json()).ok, true, 'status ok');

    const r2 = await fetch(`${base}/api/version`);
    assert.eq(r2.status, 200, 'version endpoint');
    assert.eq((await r2.json()).version, '1.0.0', 'version value');
}

await testBasicText();
await testJSON();
await testRouteParams();
await testPostJSON();
await testCustomStatus();
await testNotFound();
await testStreaming();
await testSSE();
await testGroupedRoutes();

server.close();
