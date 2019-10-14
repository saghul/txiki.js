import { run, test } from './t.js';
import { dirname, join } from '@quv/path';

const thisFile = import.meta.url.slice(7);   // strip "file://"


test('basic worker', async t => {
    const data = JSON.stringify({foo: 42, bar: 'baz!'});
    let recvData;
    const p = new Promise(resolve => {
        const w = new Worker(join(dirname(thisFile), 'helpers', 'worker.js'));
        const timer = setTimeout(() => {
            w.terminate();
            resolve();
        }, 1000);
        w.addEventListener('message', event => {
            recvData = JSON.stringify(event.data);
            w.terminate();
            clearTimeout(timer);
            resolve();
        });
    });
    await p;
    t.eq(data, recvData, 'Message received matches');
});


if (import.meta.main) {
    run();
}
