import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();


async function doEchoServer(server) {
    const reader = server.readable.getReader();

    while (true) {
        const { value: msg, done } = await reader.read();

        if (done) {
            break;
        }

        assert.ok(typeof msg.partial === 'boolean');
        assert.is(msg.partial, false);
        server.send(msg.data, msg.addr);
    }
}

const server = await tjs.listen('udp', '127.0.0.1');

doEchoServer(server);

const serverAddr = server.localAddress;
const client = await tjs.listen('udp');
client.send(encoder.encode('PING'), serverAddr);
const clientReader = client.readable.getReader();
let { value: msg } = await clientReader.read();
let dataStr = decoder.decode(msg.data);
assert.eq(dataStr, 'PING', 'sending works');
assert.eq(serverAddr, msg.addr, "source address matches");
assert.throws(() => { client.send('PING', serverAddr); }, TypeError, "sending anything else gives TypeError");
assert.throws(() => { client.send(1234, serverAddr); }, TypeError, "sending anything else gives TypeError");
clientReader.cancel();
client.close();
server.close();
