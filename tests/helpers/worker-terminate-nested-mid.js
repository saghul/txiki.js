// Middle worker: terminates a leaf worker whose digest is still running, so the
// leaf runtime is torn down (and its JS run) on this worker's thread.
import path from 'tjs:path';

self.onmessage = async () => {
    const leaf = new Worker(path.join(import.meta.dirname, 'worker-threadpool-digest-then.js'));
    const started = new Promise(resolve => {
        leaf.onmessage = resolve;
    });

    leaf.postMessage(null);
    await started;
    leaf.terminate();
    self.postMessage('done');
};
