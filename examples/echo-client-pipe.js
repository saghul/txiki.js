// Sample Pipe echo client.
//


const client = new PipeSocket(tjs.args[2] || '/tmp/fooPipe');
const { readable, writable, remoteAddress } = await client.opened;

console.log(`Connected to ${remoteAddress}`);

await readable.pipeTo(writable);
console.log('connection closed!');
