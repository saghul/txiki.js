import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();


async function doEchoServer(server) {
    const reader = server.readable.getReader();
    const writer = server.writable.getWriter();

    while (true) {
        const { value: msg, done } = await reader.read();

        if (done) {
            break;
        }

        assert.ok(typeof msg.partial === 'boolean');
        assert.is(msg.partial, false);
        await writer.write({ data: msg.data, addr: msg.addr });
    }
}

const server = await tjs.listen('udp', '127.0.0.1');

doEchoServer(server);

const serverAddr = server.localAddress;
const client = await tjs.listen('udp');
const clientWriter = client.writable.getWriter();
await clientWriter.write({ data: encoder.encode('PING'), addr: serverAddr });
const clientReader = client.readable.getReader();
let { value: msg } = await clientReader.read();
let dataStr = decoder.decode(msg.data);
assert.eq(dataStr, 'PING', 'sending works');
assert.eq(serverAddr, msg.addr, "source address matches");
clientReader.cancel();
clientWriter.close();
client.close();
server.close();
