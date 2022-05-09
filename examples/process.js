
function logStatus(s) {
    console.log(JSON.stringify(s));
}

const exe = tjs.exepath;

(async () => {
    let args, status, proc, input, data, encoder = new TextEncoder(), decoder = new TextDecoder();

    args = [exe, '-e', 'console.log(1+1)'];
    proc = tjs.spawn(args);
    console.log(`proc PID: ${proc.pid}`);
    status = await proc.wait();
    logStatus(status);

    args = ['curl', '-s', '-i', 'https://bellard.org/quickjs/'];
    proc = tjs.spawn(args);
    console.log(`proc PID: ${proc.pid}`);
    status = await proc.wait();
    logStatus(status);

    proc = tjs.spawn('cat');
    console.log(`proc PID: ${proc.pid}`);
    proc.kill(tjs.SIGTERM);
    status = await proc.wait();
    logStatus(status);
    status = await proc.wait();
    logStatus(status);

    args = [exe, '-e', 'console.log(JSON.stringify(tjs.environ))'];
    proc = tjs.spawn(args, { env: { FOO: 'BAR', SPAM: 'EGGS'} });
    console.log(`proc PID: ${proc.pid}`);
    status = await proc.wait();
    logStatus(status);
    
    proc = tjs.spawn('cat', { stdin: 'pipe', stdout: 'pipe' });
    console.log(`proc PID: ${proc.pid}`);
    console.log(proc.stdin.fileno());
    console.log(proc.stdout.fileno());
    input = encoder.encode('hello!');
    proc.stdin.write(input);
    data = new Uint8Array(input.length);
    await proc.stdout.read(data);
    console.log(decoder.decode(data));
    input = encoder.encode('hello again!');
    proc.stdin.write(input);
    data = new Uint8Array(input.length);
    await proc.stdout.read(data);
    console.log(decoder.decode(data));
    proc.kill(tjs.SIGTERM);
    status = await proc.wait();
    console.log(status);

})().catch(e => {
    console.log(e);
    console.log(e.stack);
});
