// Worker B: a grandchild of the main thread (its parent is worker A). Processes
// the work, reading the transferred buffer, and reports back up to A.

self.onmessage = e => {
    const { value, buf } = e.data;
    const bytes = new Uint8Array(buf);
    let sum = 0;

    for (const x of bytes) {
        sum += x;
    }

    self.postMessage({ result: value * 10, sum });
    self.close();
};
