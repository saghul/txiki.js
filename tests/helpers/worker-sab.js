self.addEventListener('message', e => {
    const magic = 42;
    const i32 = e.data;

    Atomics.wait(i32, 0, 0);

    self.postMessage({ success: i32[0] === magic });
});

self.addEventListener('messageerror', e => {
    throw new Error(`Opps! ${e}`);
});
