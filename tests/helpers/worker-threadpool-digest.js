// Start a digest long enough to still be running when the parent terminates us.
self.onmessage = () => {
    crypto.subtle.digest('SHA-512', new Uint8Array(8 * 1024 * 1024));
    self.postMessage('started');
};
