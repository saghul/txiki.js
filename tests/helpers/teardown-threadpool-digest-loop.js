// Die on an uncaught error while a background loop keeps queueing a new digest
// from each one's continuation.

const data = new Uint8Array(256 * 1024);
let iterations = 0;
const { promise: running, resolve } = Promise.withResolvers();

(async () => {
    for (;;) {
        await crypto.subtle.digest('SHA-256', data);

        if (++iterations === 3) {
            resolve();
        }
    }
})();

await running;

throw new Error('teardown with a digest loop running');
