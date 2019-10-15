
import { dirname, join } from '@tjs/path';

const thisFile = import.meta.url.slice(7);  // strip "file://"

tjs.loadScript(join(dirname(thisFile), 'zora.js'));

const { createHarness, mochaTapLike } = zora;
const harness = createHarness();
const { test } = harness;

function run() {
    harness
        .report(mochaTapLike)
        .then(() => {
            // set the exit code ourselves in case of failing test
            const exitCode = harness.pass === true ? 0 : 1;
            tjs.exit(exitCode);
    });
}

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    })
}

export { run, test, sleep };
