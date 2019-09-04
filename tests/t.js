
import { dirname, join } from 'path';

const thisFile = new URL(import.meta.url).pathname;

quv.loadScript(join(dirname(thisFile), 'zora.js'));

const { createHarness, mochaTapLike } = zora;
const harness = createHarness();
const { test } = harness;

function run() {
    harness
        .report(mochaTapLike)
        .then(() => {
            // set the exit code ourselves in case of failing test
            const exitCode = harness.pass === true ? 0 : 1;
            quv.exit(exitCode);
    });
}

export { run, test };
