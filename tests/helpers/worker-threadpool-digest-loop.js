// Keep queueing a new digest from each one's continuation, so there is always
// threadpool work in flight, and new work keeps arriving, when we're terminated.
self.onmessage = async () => {
    const data = new Uint8Array(256 * 1024);

    await crypto.subtle.digest('SHA-256', data);
    self.postMessage('started');

    for (;;) {
        await crypto.subtle.digest('SHA-256', data);
    }
};
