// Start a file write long enough to still be running when the parent terminates us.
self.onmessage = async e => {
    const f = await tjs.open(e.data, 'w');

    f.write(new Uint8Array(8 * 1024 * 1024));
    self.postMessage('started');
};
