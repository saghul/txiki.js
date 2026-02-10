import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();


async function doEchoServer(readable, writable) {
    const reader = readable.getReader();
    const writer = writable.getWriter();

    while (true) {
        const { value: msg, done } = await reader.read();

        if (done) {
            break;
        }

        await writer.write({ data: msg.data, remoteAddress: msg.remoteAddress, remotePort: msg.remotePort });
    }
}

const server = new UDPSocket({ localAddress: '127.0.0.1' });
const serverInfo = await server.opened;

doEchoServer(serverInfo.readable, serverInfo.writable);

const client = new UDPSocket({ localAddress: '127.0.0.1' });
const clientInfo = await client.opened;
const clientWriter = clientInfo.writable.getWriter();
await clientWriter.write({ data: encoder.encode('PING'), remoteAddress: serverInfo.localAddress, remotePort: serverInfo.localPort });
const clientReader = clientInfo.readable.getReader();
let { value: msg } = await clientReader.read();
let dataStr = decoder.decode(msg.data);
assert.eq(dataStr, 'PING', 'sending works');
assert.eq(serverInfo.localAddress, msg.remoteAddress, 'source address matches');
assert.eq(serverInfo.localPort, msg.remotePort, 'source port matches');
clientReader.cancel();
clientWriter.close();
client.close();
server.close();
