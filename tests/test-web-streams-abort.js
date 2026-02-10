import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const server = new TCPServerSocket('127.0.0.1');
const { readable: serverReadable, localAddress, localPort } = await server.opened;

const serverDone = (async () => {
    const reader = serverReadable.getReader();
    const { value: conn } = await reader.read();
    const { readable, writable } = await conn.opened;
    try {
        await readable.pipeTo(writable);
    } catch {
        // Client aborted, pipeTo may error.
    }
    await conn.closed;
})();

const client = new TCPSocket(localAddress, localPort);
const { readable, writable } = await client.opened;
const writer = writable.getWriter();
const reader = readable.getReader();

await writer.write(encoder.encode('HI'));
const { value } = await reader.read();
assert.eq(decoder.decode(value), 'HI');

// Abort the writer with a reason.
const reason = new Error('user aborted');
await writer.abort(reason);

// Server echoes the shutdown, so reader gets EOF.
const { done } = await reader.read();
assert.eq(done, true);

// closed should reject with the abort reason.
let closedError;
try {
    await client.closed;
} catch (e) {
    closedError = e;
}
assert.ok(closedError, 'closed should have rejected');
assert.eq(closedError.message, 'user aborted');

await serverDone;
server.close();
await server.closed;
