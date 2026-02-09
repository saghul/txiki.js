// Sample Pipe echo server.
//


async function handleConnection(conn) {
    console.log('Accepted connection!');

    await conn.readable.pipeTo(conn.writable);
    console.log('connection closed!');
}

const p = await tjs.listen('pipe', tjs.args[2] || '/tmp/fooPipe');

console.log(`Listening on ${p.localAddress}`);

let conn;
while (true) {
    conn = await p.accept();
    handleConnection(conn);
    conn = undefined;
}
