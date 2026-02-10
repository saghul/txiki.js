import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let pipeName;
if (navigator.userAgentData.platform === 'Windows') {
    pipeName = '\\\\?\\pipe\\testPipe';
} else {
    pipeName = 'testPipe';
}

async function doEchoServer(server) {
    const conn = await server.accept();

    if (!conn) {
        return;
    }

    await conn.readable.pipeTo(conn.writable);
}

const server = await tjs.listen('pipe', pipeName);

doEchoServer(server);

const client = await tjs.connect('pipe', server.localAddress);

const reader = client.readable.getReader();
const writer = client.writable.getWriter();
await writer.write(encoder.encode('PING'));
let { value, done } = await reader.read();
let dataStr = decoder.decode(value);
assert.eq(dataStr, "PING", "sending works");
await reader.cancel();
server.close();

let error;
try {
    await tjs.listen('pipe');
} catch (e) {
    error = e;
}
assert.isNot(error, undefined);
assert.eq(error.name, 'TypeError');

error = undefined;

try {
    await tjs.connect('pipe');
} catch (e) {
    error = e;
}
assert.isNot(error, undefined);
assert.eq(error.name, 'TypeError');
