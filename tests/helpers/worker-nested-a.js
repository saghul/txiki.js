// Worker A: spawns worker B (making the main thread a grandparent) and relays
// work between the main thread and B, re-transferring the buffer at each hop.

const b = new Worker(`${import.meta.dirname}/worker-nested-b.js`);

b.onmessage = e => {
    self.postMessage(e.data);
    b.terminate();
    self.close();
};

self.onmessage = e => {
    const { value, buf } = e.data;

    b.postMessage({ value: value + 1, buf }, [ buf ]);
};
