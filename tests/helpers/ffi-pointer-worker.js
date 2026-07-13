import { createPointer } from 'tjs:ffi';

// Rebuild the pointer from the address the main thread sent (a BigInt), then
// report back what we reconstructed. Because the worker is a thread of the same
// process, the address is valid here too.
self.onmessage = e => {
    const ptr = createPointer(e.data.addr);
    self.postMessage({ addr: ptr.value, str: ptr.toString() });
};
