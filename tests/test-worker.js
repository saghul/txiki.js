import { run, test } from './t.js';
import { dirname, join } from '@quv/path';

const thisFile = import.meta.url.slice(7);   // strip "file://"


test('basic worker', async t => {
    let message;
    const p = new Promise(resolve => {
        const w = new quv.Worker(join(dirname(thisFile), 'helpers', 'worker.js'));
        const timer = setTimeout(() => {
            w.terminate();
            resolve();
        }, 1000);
        w.onmessage = msg => { 
            message = msg;
            w.terminate();
            clearTimeout(timer);
            resolve();
        };
    });
    await p;
    t.ok(message, 'Message received');
});


if (import.meta.main) {
    run();
}
