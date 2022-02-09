// Sample Pipe echo client.
//


(async () => {
    const p = await tjs.connect('pipe', tjs.args[2] || '/tmp/fooPipe');
    
    console.log(`Connected to ${p.remoteAddress}`);

    const buf = new Uint8Array(4096);
    while (true) {
        const nread = await p.read(buf);
        if (!nread) {
            console.log('connection closed!');
            break;
        }
        //console.log(`Received: ${new TextDecoder().decode(data)}`);
        p.write(buf.slice(0, nread));
    }
})();
