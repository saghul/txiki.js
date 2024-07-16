import assert from 'tjs:assert';

const ab = new ArrayBuffer(16);
const sab = new SharedArrayBuffer(16);
const u8 = new Uint8Array(ab);
const u16 = new Uint16Array(sab);

assert.is(u8.buffer, ab);
assert.is(u16.buffer, sab);

const o1 = { ab, sab, u8, u16 };
const o2 = structuredClone(o1);

assert.is(o2.u8.buffer, o2.ab);
assert.is(o2.u16.buffer, o2.sab);
assert.isNot(ab, o2.ab);
assert.isNot(sab, o2.sab);

o2.u16[0] = 42;
assert.eq(o2.u16[0], 42);
assert.eq(u16[0], o2.u16[0]);

const o3 = structuredClone(o1, { transfer: [ o1.ab ]});

assert.is(o3.u8.buffer, o3.ab);
assert.is(o3.u16.buffer, o3.sab);
assert.isNot(ab, o3.sab);

assert.ok(ab.detached);
