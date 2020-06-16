// Sample Pipe echo server.
//


async function handleConnection(conn) {
    console.log(`Accepted connection! ${conn.getpeername()} <-> ${conn.getsockname()}`);

    let data;
    while (true) {
        data = await conn.read();
        if (!data) {
            console.log('connection closed!');
            break;
        }
        //console.log(`Received: ${new TextDecoder().decode(data)}`);
        conn.write(data);
    }
}

(async () => {
    const p = new tjs.Pipe();

    p.bind(tjs.args[2] || '/tmp/fooPipe');
    p.listen();

    console.log(`Listening on ${p.getsockname()}`); 

    let conn;
    while (true) {
        conn = await p.accept();
        handleConnection(conn);
        conn = undefined;
    }
})();
