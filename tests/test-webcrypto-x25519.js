import assert from 'tjs:assert';

// Key generation
const keyPair = await crypto.subtle.generateKey({ name: 'X25519' }, true, [ 'deriveBits', 'deriveKey' ]);
assert.ok(keyPair.publicKey);
assert.ok(keyPair.privateKey);
assert.equal(keyPair.publicKey.type, 'public');
assert.equal(keyPair.privateKey.type, 'private');
assert.equal(keyPair.publicKey.algorithm.name, 'X25519');
assert.equal(keyPair.privateKey.algorithm.name, 'X25519');
assert.deepEqual(keyPair.publicKey.usages, []);
assert.ok(keyPair.privateKey.usages.includes('deriveBits'));

// Export raw (public only)
const rawPub = await crypto.subtle.exportKey('raw', keyPair.publicKey);
assert.equal(rawPub.byteLength, 32);

// Cannot export private as raw
try {
    await crypto.subtle.exportKey('raw', keyPair.privateKey);
    assert.fail('should have thrown');
} catch (e) {
    assert.ok(e instanceof DOMException);
}

// Export/import SPKI
const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
assert.equal(spki.byteLength, 44);
const importedPub = await crypto.subtle.importKey('spki', spki, { name: 'X25519' }, true, []);
const reExported = await crypto.subtle.exportKey('raw', importedPub);
assert.deepEqual(new Uint8Array(reExported), new Uint8Array(rawPub));

// Export/import PKCS8
const pkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
assert.equal(pkcs8.byteLength, 48);
const importedPriv = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'X25519' }, true, [ 'deriveBits' ]);
assert.equal(importedPriv.type, 'private');

// Export/import JWK (private)
const jwkPriv = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
assert.equal(jwkPriv.kty, 'OKP');
assert.equal(jwkPriv.crv, 'X25519');
assert.ok(jwkPriv.x);
assert.ok(jwkPriv.d);
const importedJwkPriv = await crypto.subtle.importKey('jwk', jwkPriv, { name: 'X25519' }, true, [ 'deriveBits' ]);
assert.equal(importedJwkPriv.type, 'private');

// Export/import JWK (public)
const jwkPub = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
assert.equal(jwkPub.kty, 'OKP');
assert.equal(jwkPub.crv, 'X25519');
assert.ok(jwkPub.x);
assert.equal(jwkPub.d, undefined);
const importedJwkPub = await crypto.subtle.importKey('jwk', jwkPub, { name: 'X25519' }, true, []);
assert.equal(importedJwkPub.type, 'public');

// Import raw
const importedRaw = await crypto.subtle.importKey('raw', rawPub, { name: 'X25519' }, true, []);
assert.equal(importedRaw.type, 'public');

// deriveBits: two key pairs, shared secret must match
const kpA = await crypto.subtle.generateKey({ name: 'X25519' }, true, [ 'deriveBits', 'deriveKey' ]);
const kpB = await crypto.subtle.generateKey({ name: 'X25519' }, true, [ 'deriveBits', 'deriveKey' ]);

const sharedAB = await crypto.subtle.deriveBits(
    { name: 'X25519', public: kpB.publicKey }, kpA.privateKey, 256);
const sharedBA = await crypto.subtle.deriveBits(
    { name: 'X25519', public: kpA.publicKey }, kpB.privateKey, 256);
assert.equal(sharedAB.byteLength, 32);
assert.deepEqual(new Uint8Array(sharedAB), new Uint8Array(sharedBA));

// deriveBits with null length returns full 32 bytes
const sharedNull = await crypto.subtle.deriveBits(
    { name: 'X25519', public: kpB.publicKey }, kpA.privateKey, null);
assert.equal(sharedNull.byteLength, 32);
assert.deepEqual(new Uint8Array(sharedNull), new Uint8Array(sharedAB));

// deriveBits with shorter length truncates
const shared128 = await crypto.subtle.deriveBits(
    { name: 'X25519', public: kpB.publicKey }, kpA.privateKey, 128);
assert.equal(shared128.byteLength, 16);
assert.deepEqual(new Uint8Array(shared128), new Uint8Array(sharedAB).slice(0, 16));

// deriveKey
const derivedKey = await crypto.subtle.deriveKey(
    { name: 'X25519', public: kpB.publicKey },
    kpA.privateKey,
    { name: 'AES-GCM', length: 256 },
    true,
    [ 'encrypt', 'decrypt' ]);
assert.equal(derivedKey.algorithm.name, 'AES-GCM');

// RFC 7748 test vector
const alicePriv = new Uint8Array([
    0x77, 0x07, 0x6d, 0x0a, 0x73, 0x18, 0xa5, 0x7d,
    0x3c, 0x16, 0xc1, 0x72, 0x51, 0xb2, 0x66, 0x45,
    0xdf, 0x4c, 0x2f, 0x87, 0xeb, 0xc0, 0x99, 0x2a,
    0xb1, 0x77, 0xfb, 0xa5, 0x1d, 0xb9, 0x2c, 0x2a,
]);
const bobPub = new Uint8Array([
    0xde, 0x9e, 0xdb, 0x7d, 0x7b, 0x7d, 0xc1, 0xb4,
    0xd3, 0x5b, 0x61, 0xc2, 0xec, 0xe4, 0x35, 0x37,
    0x3f, 0x83, 0x43, 0xc8, 0x5b, 0x78, 0x67, 0x4d,
    0xad, 0xfc, 0x7e, 0x14, 0x6f, 0x88, 0x2b, 0x4f,
]);
const expectedShared = new Uint8Array([
    0x4a, 0x5d, 0x9d, 0x5b, 0xa4, 0xce, 0x2d, 0xe1,
    0x72, 0x8e, 0x3b, 0xf4, 0x80, 0x35, 0x0f, 0x25,
    0xe0, 0x7e, 0x21, 0xc9, 0x47, 0xd1, 0x9e, 0x33,
    0x76, 0xf0, 0x9b, 0x3c, 0x1e, 0x16, 0x17, 0x42,
]);

// Build PKCS8 manually: header + privkey
const pkcs8Header = new Uint8Array([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20,
]);
const alicePkcs8 = new Uint8Array(48);
alicePkcs8.set(pkcs8Header, 0);
alicePkcs8.set(alicePriv, 16);

const alicePrivKey = await crypto.subtle.importKey('pkcs8', alicePkcs8, { name: 'X25519' }, false, [ 'deriveBits' ]);
const bobPubKey = await crypto.subtle.importKey('raw', bobPub, { name: 'X25519' }, false, []);

const shared = await crypto.subtle.deriveBits(
    { name: 'X25519', public: bobPubKey }, alicePrivKey, 256);
assert.deepEqual(new Uint8Array(shared), expectedShared);
