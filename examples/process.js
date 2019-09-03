
import * as uv from 'uv';

function logStatus(s) {
    console.log(JSON.stringify(s));
}

const exe = quv.exepath();

(async () => {
    let args, status, proc;

    args = [exe, '-e', 'console.log(1+1)'];
    proc = quv.spawn(args);
    console.log(`proc PID: ${proc.pid}`);
    status = await proc.wait();
    logStatus(status);

    args = ['curl', '-s', '-i', 'https://bellard.org/quickjs/'];
    proc = quv.spawn(args);
    console.log(`proc PID: ${proc.pid}`);
    status = await proc.wait();
    logStatus(status);

    proc = quv.spawn('cat');
    console.log(`proc PID: ${proc.pid}`);
    proc.kill(quv.SIGTERM);
    status = await proc.wait();
    logStatus(status);
    status = await proc.wait();
    logStatus(status);

    args = [exe, '-e', 'console.log(JSON.stringify(quv.environ()))'];
    proc = quv.spawn(args, { env: { FOO: 'BAR', SPAM: 'EGGS'} });
    console.log(`proc PID: ${proc.pid}`);
    status = await proc.wait();
    logStatus(status);

    const buf = new ArrayBuffer(1024);
    let nread;
    proc = quv.spawn('cat', { stdin: 'pipe', stdout: 'pipe' });
    console.log(`proc PID: ${proc.pid}`);
    console.log(proc.stdin.fileno());
    console.log(proc.stdout.fileno());
    proc.stdin.write('hello!');
    nread = await proc.stdout.read(buf);
    console.log(String.fromCharCode.apply(null, new Uint8Array(buf, 0, nread)));
    proc.stdin.write('hello again!');
    nread = await proc.stdout.read(buf);
    console.log(String.fromCharCode.apply(null, new Uint8Array(buf, 0, nread)));
    proc.kill(quv.SIGTERM);
    status = await proc.wait();
    logStatus(status);

})().catch(e => {
    console.log(e);
    console.log(e.stack);
});