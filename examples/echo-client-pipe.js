// Sample Pipe echo client.
//


const p = await tjs.connect('pipe', tjs.args[2] || '/tmp/fooPipe');

console.log(`Connected to ${p.remoteAddress}`);

await p.readable.pipeTo(p.writable);
console.log('connection closed!');
