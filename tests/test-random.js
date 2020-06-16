import assert from './assert.js';


const TypedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const TypedArrayProto_toStringTag = Object.getOwnPropertyDescriptor(TypedArrayPrototype, Symbol.toStringTag).get;

const types = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array];
const buf = new ArrayBuffer(256);

for (const type of types) {
    const ta = new type(buf);
    window.crypto.getRandomValues(ta);
    const taStr = TypedArrayProto_toStringTag.call(ta);
    assert.ok(ta, `getRandomValues works for ${taStr}`);
}

const badTypes = [null, undefined, {}, '', NaN, 123];

for (const type of badTypes) {
    assert.throws(() => { window.crypto.getRandomValues(type) }, TypeError, `throws TypeError for ${type}`);
}

assert.throws(() => { window.crypto.getRandomValues(new Uint8Array(largeBuf)) }, Error, 'large buffer length throws');
const largeBuf = new ArrayBuffer(128 * 1024);
assert.throws(() => { window.crypto.getRandomValues(new Uint8Array(largeBuf)) }, Error, 'large buffer length throws');
