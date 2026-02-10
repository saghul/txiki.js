// Sample Pipe echo server.
//


async function handleConnection(conn) {
    console.log('Accepted connection!');

    const { readable, writable } = await conn.opened;

    await readable.pipeTo(writable);
    console.log('connection closed!');
}

const server = new PipeServerSocket(tjs.args[2] || '/tmp/fooPipe');
const { readable, localAddress } = await server.opened;

console.log(`Listening on ${localAddress}`);

const reader = readable.getReader();

while (true) {
    const { value: conn, done } = await reader.read();

    if (done) {
        break;
    }

    handleConnection(conn);
}
