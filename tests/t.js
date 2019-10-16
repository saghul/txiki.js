
import { dirname, join } from '@tjs/path';

const thisFile = import.meta.url.slice(7);  // strip "file://"

tjs.loadScript(join(dirname(thisFile), 'zora.js'));

const { createHarness, mochaTapLike } = zora;
const harness = createHarness();
const { test } = harness;

async function run() {
    try {
        await harness.report(mochaTapLike)
    } catch (e) {
        console.error(e);
        tjs.exit(1);
    } finally {
        tjs.exit(harness.pass ? 0 : 1);
    }
}

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    })
}

export { run, test, sleep };
