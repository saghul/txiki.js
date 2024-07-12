import assert from 'tjs:assert';

const ab = new ArrayBuffer(16);
const u8 = new Uint8Array(ab);
const u16 = new Uint16Array(ab);

assert.is(u8.buffer, ab);
assert.is(u16.buffer, ab);

const o1 = { ab, u8, u16 };
const o2 = structuredClone(o1);

assert.is(o2.u8.buffer, o2.ab);
assert.is(o2.u16.buffer, o2.ab);
assert.isNot(ab, o2.ab);

const o3 = structuredClone(o1, { transfer: [ o1.ab ]});

assert.is(o3.u8.buffer, o3.ab);
assert.is(o3.u16.buffer, o3.ab);
assert.isNot(ab, o3.ab);

assert.ok(ab.detached);
