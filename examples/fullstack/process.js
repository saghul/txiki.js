
function logStatus(s) {
    console.log(JSON.stringify(s));
}

const exe = tjs.exePath;

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
proc.kill('SIGTERM');
status = await proc.wait();
logStatus(status);
status = await proc.wait();
logStatus(status);

args = [exe, '-e', 'console.log(JSON.stringify(tjs.env))'];
proc = tjs.spawn(args, { env: { FOO: 'BAR', SPAM: 'EGGS'} });
console.log(`proc PID: ${proc.pid}`);
status = await proc.wait();
logStatus(status);

proc = tjs.spawn('cat', { stdin: 'pipe', stdout: 'pipe' });
console.log(`proc PID: ${proc.pid}`);
const writer = proc.stdin.getWriter();
const reader = proc.stdout.getReader();
input = encoder.encode('hello!');
await writer.write(input);
data = await reader.read();
console.log(decoder.decode(data.value));
input = encoder.encode('hello again!');
await writer.write(input);
data = await reader.read();
console.log(decoder.decode(data.value));
writer.close();
status = await proc.wait();
console.log(status);
