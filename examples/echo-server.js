'use strict';

function addr(obj) {
    return `${obj.ip}:${obj.port}`;
}

function logError(e) {
    console.log(`Oops! ${e}`);
    console.log(e.stack);
}

async function handleConnection(conn) {
    console.log(`Accepted connection! ${addr(conn.getpeername())} <-> ${addr(conn.getsockname())}`);

    let data;
    while (true) {
        data = await conn.read();
        //console.log(String.fromCharCode.apply(null, new Uint8Array(data)))
        if (!data) {
            console.log('connection closed!');
            break;
        }
        await conn.write(data);
    }
}

(async () => {
    const t = new uv.TCP();

    t.bind({ip: global.scriptArgs[1] || '127.0.0.1', port: global.scriptArgs[2] || 1234});
    t.listen();

    console.log(`Listening on ${addr(t.getsockname())}`); 

    let conn;
    while (true) {
        conn = await t.accept();
        handleConnection(conn);
        conn = undefined;
    }

})().catch(logError);
