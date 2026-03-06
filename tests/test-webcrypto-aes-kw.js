import assert from 'tjs:assert';

// Generate an AES-KW wrapping key
const wrapKey = await crypto.subtle.generateKey(
    { name: 'AES-KW', length: 256 },
    true,
    [ 'wrapKey', 'unwrapKey' ]);
assert.equal(wrapKey.algorithm.name, 'AES-KW');
assert.equal(wrapKey.algorithm.length, 256);

// Generate an AES-GCM key to wrap
const dataKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    [ 'encrypt', 'decrypt' ]);

// Wrap (raw format)
const wrapped = await crypto.subtle.wrapKey('raw', dataKey, wrapKey, { name: 'AES-KW' });
// AES-KW adds 8 bytes
assert.equal(wrapped.byteLength, 32 + 8);

// Unwrap
const unwrapped = await crypto.subtle.unwrapKey(
    'raw', wrapped, wrapKey, { name: 'AES-KW' },
    { name: 'AES-GCM' }, true, [ 'encrypt', 'decrypt' ]);
assert.equal(unwrapped.algorithm.name, 'AES-GCM');

// Verify the unwrapped key matches the original
const rawOriginal = await crypto.subtle.exportKey('raw', dataKey);
const rawUnwrapped = await crypto.subtle.exportKey('raw', unwrapped);
assert.deepEqual(new Uint8Array(rawUnwrapped), new Uint8Array(rawOriginal));

// Wrap/unwrap with JWK format
const wrappedJwk = await crypto.subtle.wrapKey('jwk', dataKey, wrapKey, { name: 'AES-KW' });
// JWK is variable length, but must be padded to 8-byte multiple
assert.equal(wrappedJwk.byteLength % 8, 0);

const unwrappedJwk = await crypto.subtle.unwrapKey(
    'jwk', wrappedJwk, wrapKey, { name: 'AES-KW' },
    { name: 'AES-GCM' }, true, [ 'encrypt', 'decrypt' ]);
const rawFromJwk = await crypto.subtle.exportKey('raw', unwrappedJwk);
assert.deepEqual(new Uint8Array(rawFromJwk), new Uint8Array(rawOriginal));

// 128-bit wrapping key
const wrapKey128 = await crypto.subtle.generateKey(
    { name: 'AES-KW', length: 128 },
    true,
    [ 'wrapKey', 'unwrapKey' ]);
assert.equal(wrapKey128.algorithm.length, 128);

const wrapped128 = await crypto.subtle.wrapKey('raw', dataKey, wrapKey128, { name: 'AES-KW' });
const unwrapped128 = await crypto.subtle.unwrapKey(
    'raw', wrapped128, wrapKey128, { name: 'AES-KW' },
    { name: 'AES-GCM' }, true, [ 'encrypt', 'decrypt' ]);
const raw128 = await crypto.subtle.exportKey('raw', unwrapped128);
assert.deepEqual(new Uint8Array(raw128), new Uint8Array(rawOriginal));

// Export/import raw
const rawWrapKey = await crypto.subtle.exportKey('raw', wrapKey);
assert.equal(rawWrapKey.byteLength, 32);
const importedWrapKey = await crypto.subtle.importKey(
    'raw', rawWrapKey, { name: 'AES-KW' }, true, [ 'wrapKey', 'unwrapKey' ]);

// Unwrap with imported key should produce same result
const unwrappedViaImported = await crypto.subtle.unwrapKey(
    'raw', wrapped, importedWrapKey, { name: 'AES-KW' },
    { name: 'AES-GCM' }, true, [ 'encrypt', 'decrypt' ]);
const rawViaImported = await crypto.subtle.exportKey('raw', unwrappedViaImported);
assert.deepEqual(new Uint8Array(rawViaImported), new Uint8Array(rawOriginal));

// Export/import JWK
const jwk = await crypto.subtle.exportKey('jwk', wrapKey);
assert.equal(jwk.kty, 'oct');
assert.equal(jwk.alg, 'A256KW');
const importedJwk = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'AES-KW' }, true, [ 'wrapKey', 'unwrapKey' ]);
const unwrappedViaJwk = await crypto.subtle.unwrapKey(
    'raw', wrapped, importedJwk, { name: 'AES-KW' },
    { name: 'AES-GCM' }, true, [ 'encrypt', 'decrypt' ]);
const rawViaJwk = await crypto.subtle.exportKey('raw', unwrappedViaJwk);
assert.deepEqual(new Uint8Array(rawViaJwk), new Uint8Array(rawOriginal));

// Invalid usages: AES-KW does not support encrypt/decrypt
try {
    await crypto.subtle.generateKey(
        { name: 'AES-KW', length: 256 }, true, [ 'encrypt' ]);
    assert.fail('should have thrown');
} catch (e) {
    assert.ok(e instanceof DOMException);
}

// Wrapping an HMAC key (different key type)
const hmacKey = await crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' }, true, [ 'sign', 'verify' ]);
const wrappedHmac = await crypto.subtle.wrapKey('raw', hmacKey, wrapKey, { name: 'AES-KW' });
const unwrappedHmac = await crypto.subtle.unwrapKey(
    'raw', wrappedHmac, wrapKey, { name: 'AES-KW' },
    { name: 'HMAC', hash: 'SHA-256' }, true, [ 'sign', 'verify' ]);
assert.equal(unwrappedHmac.algorithm.name, 'HMAC');

// RFC 3394 test vector: 128-bit KEK wrapping 128-bit key
const rfcKek = new Uint8Array([
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
    0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F,
]);
const rfcKeyData = new Uint8Array([
    0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
    0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF,
]);
const rfcExpected = new Uint8Array([
    0x1F, 0xA6, 0x8B, 0x0A, 0x81, 0x12, 0xB4, 0x47,
    0xAE, 0xF3, 0x4B, 0xD8, 0xFB, 0x5A, 0x7B, 0x82,
    0x9D, 0x3E, 0x86, 0x23, 0x71, 0xD2, 0xCF, 0xE5,
]);

const rfcImportedKek = await crypto.subtle.importKey(
    'raw', rfcKek, { name: 'AES-KW' }, false, [ 'wrapKey', 'unwrapKey' ]);

// Wrap the key data via wrapKey: import as AES-CBC (arbitrary), then wrap
const rfcDataKey = await crypto.subtle.importKey(
    'raw', rfcKeyData, { name: 'AES-CBC' }, true, [ 'encrypt' ]);
const rfcWrapped = await crypto.subtle.wrapKey('raw', rfcDataKey, rfcImportedKek, { name: 'AES-KW' });
assert.deepEqual(new Uint8Array(rfcWrapped), rfcExpected);

// Unwrap and verify
const rfcUnwrapped = await crypto.subtle.unwrapKey(
    'raw', rfcWrapped, rfcImportedKek, { name: 'AES-KW' },
    { name: 'AES-CBC' }, true, [ 'encrypt' ]);
const rfcRaw = await crypto.subtle.exportKey('raw', rfcUnwrapped);
assert.deepEqual(new Uint8Array(rfcRaw), rfcKeyData);
