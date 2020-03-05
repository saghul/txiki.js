import { run } from './t.js';
import { dirname, join } from '@tjs/path';

const thisFile = import.meta.url.slice(7);  // strip "file://"


(async function() {
    const dirIter = await tjs.fs.readdir(dirname(thisFile));
    const tests = [];
    for await (const item of dirIter) {
        const { name } = item;
        if (name.startsWith('test-') && name.endsWith('.js')) {
            tests.push(name);
        }
    }
    for (const name of tests.sort()) {
        await import(`./${name}`);
    }

    await run();
})();
