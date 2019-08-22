
import * as uv from 'uv';

function logStatus(s) {
    console.log(JSON.stringify(s));
}

const exe = uv.exepath();

(async () => {
    let args, status, proc;

    args = [exe, '-e', 'console.log(1+1)'];
    proc = uv.spawn(args);
    console.log(`proc PID: ${proc.pid}`);
    status = await proc.wait();
    logStatus(status);

    args = ['curl', '-s', '-i', 'https://bellard.org/quickjs/'];
    proc = uv.spawn(args);
    console.log(`proc PID: ${proc.pid}`);
    status = await proc.wait();
    logStatus(status);

    proc = uv.spawn('cat');
    console.log(`proc PID: ${proc.pid}`);
    proc.kill(uv.SIGTERM);
    status = await proc.wait();
    logStatus(status);
    status = await proc.wait();
    logStatus(status);

    args = [exe, '-e', 'console.log(JSON.stringify(uv.environ()))'];
    proc = uv.spawn(args, { env: { FOO: 'BAR', SPAM: 'EGGS'} });
    console.log(`proc PID: ${proc.pid}`);
    status = await proc.wait();
    logStatus(status);

    const buf = new ArrayBuffer(1024);
    let nread;
    proc = uv.spawn('cat', { stdin: 'pipe', stdout: 'pipe' });
    console.log(`proc PID: ${proc.pid}`);
    console.log(proc.stdin.fileno());
    console.log(proc.stdout.fileno());
    proc.stdin.write('hello!');
    nread = await proc.stdout.read(buf);
    console.log(String.fromCharCode.apply(null, new Uint8Array(buf, 0, nread)));
    proc.stdin.write('hello again!');
    nread = await proc.stdout.read(buf);
    console.log(String.fromCharCode.apply(null, new Uint8Array(buf, 0, nread)));
    proc.kill(uv.SIGTERM);
    status = await proc.wait();
    logStatus(status);

})().catch(e => {
    console.log(e);
    console.log(e.stack);
});