// Sample Pipe echo server.
//


async function handleConnection(conn) {
    console.log('Accepted connection!');

    const buf = new Uint8Array(4096);
    while (true) {
        const nread = await conn.read(buf);
        if (!nread) {
            console.log('connection closed!');
            break;
        }
        //console.log(`Received: ${new TextDecoder().decode(data)}`);
        conn.write(buf.slice(0, nread));
    }
}

(async () => {
    const p = await tjs.listen('pipe', tjs.args[2] || '/tmp/fooPipe');

    console.log(`Listening on ${p.localAddress}`);

    let conn;
    while (true) {
        conn = await p.accept();
        handleConnection(conn);
        conn = undefined;
    }
})();
