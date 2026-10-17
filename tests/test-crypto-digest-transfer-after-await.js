import assert from 'tjs:assert';

// Once a digest has resolved the threadpool no longer reads the input, so the
// buffer must be transferable from the code right after the await. The pin has
// to be released before the completion callback runs (it drains microtasks).

const data = new Uint8Array(1024 * 1024).fill(0x61);

await crypto.subtle.digest('SHA-256', data);

const clone = structuredClone(data.buffer, { transfer: [ data.buffer ] });

assert.eq(data.buffer.detached, true, 'buffer detached right after the awaited digest');
assert.eq(clone.byteLength, 1024 * 1024, 'clone has the contents');
