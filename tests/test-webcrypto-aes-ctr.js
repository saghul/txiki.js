import assert from 'tjs:assert';

// Generate a 256-bit AES-CTR key
const key = await crypto.subtle.generateKey(
    { name: 'AES-CTR', length: 256 },
    true,
    [ 'encrypt', 'decrypt' ]);
assert.equal(key.algorithm.name, 'AES-CTR');
assert.equal(key.algorithm.length, 256);

// Encrypt
const counter = new Uint8Array(16);
crypto.getRandomValues(counter);
const plaintext = new TextEncoder().encode('Hello, AES-CTR!');
const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-CTR', counter, length: 64 },
    key, plaintext);
assert.equal(ciphertext.byteLength, plaintext.byteLength);

// Decrypt
const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CTR', counter, length: 64 },
    key, ciphertext);
assert.deepEqual(new Uint8Array(decrypted), plaintext);

// Different counter produces different ciphertext
const counter2 = new Uint8Array(16);
crypto.getRandomValues(counter2);
const ciphertext2 = await crypto.subtle.encrypt(
    { name: 'AES-CTR', counter: counter2, length: 64 },
    key, plaintext);
// Extremely unlikely to be equal with different counters
const ct1 = new Uint8Array(ciphertext);
const ct2 = new Uint8Array(ciphertext2);
let same = true;
for (let i = 0; i < ct1.length; i++) {
    if (ct1[i] !== ct2[i]) { same = false; break; }
}
assert.ok(!same);

// 128-bit key
const key128 = await crypto.subtle.generateKey(
    { name: 'AES-CTR', length: 128 },
    true,
    [ 'encrypt', 'decrypt' ]);
assert.equal(key128.algorithm.length, 128);

const ct128 = await crypto.subtle.encrypt(
    { name: 'AES-CTR', counter, length: 64 },
    key128, plaintext);
const pt128 = await crypto.subtle.decrypt(
    { name: 'AES-CTR', counter, length: 64 },
    key128, ct128);
assert.deepEqual(new Uint8Array(pt128), plaintext);

// Export/import raw
const rawKey = await crypto.subtle.exportKey('raw', key);
assert.equal(rawKey.byteLength, 32);
const importedKey = await crypto.subtle.importKey(
    'raw', rawKey, { name: 'AES-CTR' }, true, [ 'encrypt', 'decrypt' ]);
const ct3 = await crypto.subtle.encrypt(
    { name: 'AES-CTR', counter, length: 64 },
    importedKey, plaintext);
assert.deepEqual(new Uint8Array(ct3), new Uint8Array(ciphertext));

// Export/import JWK
const jwk = await crypto.subtle.exportKey('jwk', key);
assert.equal(jwk.kty, 'oct');
assert.equal(jwk.alg, 'A256CTR');
const importedJwk = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'AES-CTR' }, true, [ 'encrypt', 'decrypt' ]);
const ct4 = await crypto.subtle.encrypt(
    { name: 'AES-CTR', counter, length: 64 },
    importedJwk, plaintext);
assert.deepEqual(new Uint8Array(ct4), new Uint8Array(ciphertext));

// Empty plaintext
const ctEmpty = await crypto.subtle.encrypt(
    { name: 'AES-CTR', counter, length: 64 },
    key, new Uint8Array(0));
assert.equal(ctEmpty.byteLength, 0);

// deriveKey producing AES-CTR key
const kpA = await crypto.subtle.generateKey({ name: 'X25519' }, true, [ 'deriveKey' ]);
const kpB = await crypto.subtle.generateKey({ name: 'X25519' }, true, [ 'deriveKey' ]);
const derivedKey = await crypto.subtle.deriveKey(
    { name: 'X25519', public: kpB.publicKey },
    kpA.privateKey,
    { name: 'AES-CTR', length: 256 },
    true,
    [ 'encrypt', 'decrypt' ]);
assert.equal(derivedKey.algorithm.name, 'AES-CTR');
assert.equal(derivedKey.algorithm.length, 256);

// Validate counter must be 16 bytes
try {
    await crypto.subtle.encrypt(
        { name: 'AES-CTR', counter: new Uint8Array(8), length: 64 },
        key, plaintext);
    assert.fail('should have thrown');
} catch (e) {
    assert.ok(e instanceof DOMException);
}

// Validate length must be 1-128
try {
    await crypto.subtle.encrypt(
        { name: 'AES-CTR', counter, length: 0 },
        key, plaintext);
    assert.fail('should have thrown');
} catch (e) {
    assert.ok(e instanceof DOMException);
}

try {
    await crypto.subtle.encrypt(
        { name: 'AES-CTR', counter, length: 129 },
        key, plaintext);
    assert.fail('should have thrown');
} catch (e) {
    assert.ok(e instanceof DOMException);
}

// NIST SP 800-38A F.5.1 test vector: AES-128-CTR encrypt
const nistKey = new Uint8Array([
    0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6,
    0xab, 0xf7, 0x15, 0x88, 0x09, 0xcf, 0x4f, 0x3c,
]);
const nistCounter = new Uint8Array([
    0xf0, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7,
    0xf8, 0xf9, 0xfa, 0xfb, 0xfc, 0xfd, 0xfe, 0xff,
]);
const nistPlaintext = new Uint8Array([
    0x6b, 0xc1, 0xbe, 0xe2, 0x2e, 0x40, 0x9f, 0x96,
    0xe9, 0x3d, 0x7e, 0x11, 0x73, 0x93, 0x17, 0x2a,
]);
const nistExpected = new Uint8Array([
    0x87, 0x4d, 0x61, 0x91, 0xb6, 0x20, 0xe3, 0x26,
    0x1b, 0xef, 0x68, 0x64, 0x99, 0x0d, 0xb6, 0xce,
]);

const nistImportedKey = await crypto.subtle.importKey(
    'raw', nistKey, { name: 'AES-CTR' }, false, [ 'encrypt' ]);
const nistCiphertext = await crypto.subtle.encrypt(
    { name: 'AES-CTR', counter: nistCounter, length: 32 },
    nistImportedKey, nistPlaintext);
assert.deepEqual(new Uint8Array(nistCiphertext), nistExpected);
