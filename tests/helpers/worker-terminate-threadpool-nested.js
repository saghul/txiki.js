// Main -> mid worker -> leaf worker; mid terminates the leaf while its digest runs.
import path from 'tjs:path';

const mid = new Worker(path.join(import.meta.dirname, 'worker-terminate-nested-mid.js'));
const done = new Promise(resolve => {
    mid.onmessage = resolve;
});

mid.postMessage(null);
await done;
mid.terminate();

console.log('nested: ok');
