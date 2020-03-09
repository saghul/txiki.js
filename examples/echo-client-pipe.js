// Sample Pipe echo client.
//


(async () => {
    const p = new tjs.Pipe();
    
    await p.connect(tjs.args[2] || '/tmp/fooPipe');
    
    console.log(`Connected to ${p.getpeername()}`);

    let data;
    while (true) {
        data = await p.read();
        if (!data) {
            console.log('connection closed!');
            break;
        }
        //console.log(`Received: ${new TextDecoder().decode(data)}`);
        p.write(data);
    }
})();
