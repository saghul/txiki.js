import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let pipeName;
if (navigator.userAgentData.platform === 'Windows') {
    pipeName = '\\\\?\\pipe\\testPipe';
} else {
    pipeName = 'testPipe';
}

async function doEchoServer(serverReadable) {
    const reader = serverReadable.getReader();
    const { value: conn } = await reader.read();

    if (!conn) {
        return;
    }

    const { readable, writable } = await conn.opened;

    await readable.pipeTo(writable);
}

const server = new PipeServerSocket(pipeName);
const { readable: serverReadable, localAddress } = await server.opened;

doEchoServer(serverReadable);

const client = new PipeSocket(localAddress);
const { readable, writable } = await client.opened;

const writer = writable.getWriter();
const reader = readable.getReader();
await writer.write(encoder.encode('PING'));
let { value, done } = await reader.read();
let dataStr = decoder.decode(value);
assert.eq(dataStr, "PING", "sending works");

await writer.close();
const eof = await reader.read();
assert.eq(eof.done, true);

client.close();
server.close();

let error;
try {
    new PipeServerSocket();
} catch (e) {
    error = e;
}
assert.isNot(error, undefined);
assert.eq(error.name, 'TypeError');

error = undefined;

try {
    new PipeSocket();
} catch (e) {
    error = e;
}
assert.isNot(error, undefined);
assert.eq(error.name, 'TypeError');
