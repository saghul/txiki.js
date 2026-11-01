// Leaf worker: its digest continuation only runs during the teardown drain,
// which happens on the thread of the worker that terminates us.
self.onmessage = () => {
    crypto.subtle.digest('SHA-512', new Uint8Array(8 * 1024 * 1024)).then(() => {
        console.log('DRAIN-JS-RAN');
    });
    self.postMessage('started');
};
