// Sample UDP echo server.
//


const server = new UDPSocket({
    localAddress: tjs.args[2] || '127.0.0.1',
    localPort: Number(tjs.args[3]) || 1234,
});
const { readable, writable, localAddress, localPort } = await server.opened;

console.log(`Listening on ${localAddress}:${localPort}`);

const decoder = new TextDecoder();
const reader = readable.getReader();
const writer = writable.getWriter();

while (true) {
    const { value: msg, done } = await reader.read();

    if (done) {
        break;
    }

    await writer.write({ data: msg.data, remoteAddress: msg.remoteAddress, remotePort: msg.remotePort });

    if (decoder.decode(msg.data) === 'quit\n') {
        break;
    }
}

server.close();

console.log('END');
