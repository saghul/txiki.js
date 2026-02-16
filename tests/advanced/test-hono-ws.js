import assert from 'tjs:assert';
import { Hono } from './generated/hono.js';
import { serveWithWebSocket, createWSHandler } from './hono-adapter.js';


const app = new Hono();

// HTTP routes.
app.get('/', (c) => c.text('hello from hono'));
app.get('/json', (c) => c.json({ ok: true }));
app.post('/echo', async (c) => {
    const body = await c.req.text();

    return c.text(`echo: ${body}`);
});

// WS echo route.
app.get('/ws/echo', createWSHandler((handlers) => {
    handlers.onMessage = (ws, data) => {
        ws.sendText('echo: ' + data);
    };
}));

// WS chat-style route with open/close.
app.get('/ws/chat', createWSHandler((handlers) => {
    handlers.onOpen = (ws) => {
        ws.sendText('welcome');
    };
    handlers.onMessage = (ws, data) => {
        ws.sendText('you said: ' + data);
    };
}));


const server = serveWithWebSocket(app, { port: 0 });
const base = `http://127.0.0.1:${server.port}`;
const wsBase = `ws://127.0.0.1:${server.port}`;


// Test: HTTP text route.
async function testHttpText() {
    const resp = await fetch(`${base}/`);
    assert.eq(resp.status, 200, 'status is 200');
    assert.eq(await resp.text(), 'hello from hono', 'body matches');
}

// Test: HTTP JSON route.
async function testHttpJson() {
    const resp = await fetch(`${base}/json`);
    assert.eq(resp.status, 200, 'status is 200');

    const json = await resp.json();
    assert.eq(json.ok, true, 'json ok');
}

// Test: HTTP POST echo.
async function testHttpPostEcho() {
    const resp = await fetch(`${base}/echo`, {
        method: 'POST',
        body: 'hello',
    });
    assert.eq(await resp.text(), 'echo: hello', 'POST echo');
}

// Test: WS echo route.
async function testWsEcho() {
    const ws = new WebSocket(`${wsBase}/ws/echo`);

    const result = await new Promise((resolve, reject) => {
        ws.onopen = () => ws.send('hi');
        ws.onmessage = (e) => {
            resolve(e.data);
            ws.close();
        };
        ws.onerror = () => reject(new Error('ws error'));
    });

    assert.eq(result, 'echo: hi', 'WS echo works');
}

// Test: WS chat route with open message.
async function testWsChat() {
    const ws = new WebSocket(`${wsBase}/ws/chat`);
    const messages = [];

    const done = new Promise((resolve, reject) => {
        ws.onmessage = (e) => {
            messages.push(e.data);

            if (messages.length === 1) {
                // Got the welcome message, now send something.
                ws.send('hello');
            } else if (messages.length === 2) {
                resolve();
            }
        };
        ws.onerror = () => reject(new Error('ws error'));
    });

    await done;
    ws.close();
    assert.eq(messages[0], 'welcome', 'welcome message on open');
    assert.eq(messages[1], 'you said: hello', 'chat echo');
}

// Test: 404 for unknown route.
async function testNotFound() {
    const resp = await fetch(`${base}/does-not-exist`);
    assert.eq(resp.status, 404, 'status is 404');
}

// Test: HTTP still works after WS connections.
async function testHttpAfterWs() {
    const resp = await fetch(`${base}/json`);
    assert.eq(resp.status, 200, 'HTTP still works');

    const json = await resp.json();
    assert.eq(json.ok, true, 'json ok after WS');
}

await testHttpText();
await testHttpJson();
await testHttpPostEcho();
await testWsEcho();
await testWsChat();
await testNotFound();
await testHttpAfterWs();

server.close();
