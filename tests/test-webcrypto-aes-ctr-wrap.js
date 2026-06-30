// AES-CTR counter must wrap within its `length`-bit window without carrying into
// the nonce (the leftmost 128 - length bits). mbedtls increments the whole
// 128-bit block, so a naive implementation corrupts the nonce on overflow. These
// checks are reference-free: they exploit the spec relationship between a wrapped
// counter and an explicit fresh counter, and fail on the buggy full-width path.

import assert from 'tjs:assert';

const rawKey = new Uint8Array([
    0x60, 0x3d, 0xeb, 0x10, 0x15, 0xca, 0x71, 0xbe,
    0x2b, 0x73, 0xae, 0xf0, 0x85, 0x7d, 0x77, 0x81,
    0x1f, 0x35, 0x2c, 0x07, 0x3b, 0x61, 0x08, 0xd7,
    0x2d, 0x98, 0x10, 0xa3, 0x09, 0x14, 0xdf, 0xf4,
]);
const key = await crypto.subtle.importKey(
    'raw', rawKey, { name: 'AES-CTR' }, false, [ 'encrypt', 'decrypt' ]);

function enc(counter, length, data) {
    return crypto.subtle.encrypt({ name: 'AES-CTR', counter, length }, key, data)
        .then(b => new Uint8Array(b));
}
function dec(counter, length, data) {
    return crypto.subtle.decrypt({ name: 'AES-CTR', counter, length }, key, data)
        .then(b => new Uint8Array(b));
}

// --- Core property: counter wrap preserves the nonce ---------------------------
//
// With a length-bit counter set to its max value (all ones), encrypting two
// blocks uses counter values [2^length - 1, 0]; the second block's counter wraps
// to 0 while the nonce is unchanged. Encrypting one block with the counter
// explicitly set to 0 (same nonce) must yield the same keystream for that block.
// Encrypting all-zero plaintext exposes the keystream directly.

for (const length of [ 8, 16, 32, 64 ]) {
    const nonceFill = 0xa5;
    const fullBytes = length / 8; // all these lengths are byte-aligned

    // Counter at max: nonce bytes = nonceFill, low `length` bits = all ones.
    const ctrMax = new Uint8Array(16).fill(nonceFill);
    for (let i = 0; i < fullBytes; i++) {
        ctrMax[15 - i] = 0xff;
    }

    // Same nonce, counter window = 0.
    const ctrZero = new Uint8Array(16).fill(nonceFill);
    for (let i = 0; i < fullBytes; i++) {
        ctrZero[15 - i] = 0x00;
    }

    const ks2 = await enc(ctrMax, length, new Uint8Array(32));  // two blocks, wraps
    const ks1 = await enc(ctrZero, length, new Uint8Array(16)); // one block at counter 0

    // Second block of the wrapped stream == first block at counter 0.
    assert.deepEqual(ks2.slice(16, 32), ks1.slice(0, 16),
        `length=${length}: wrap must preserve the nonce`);

    // Sanity: the two blocks of the wrapped stream differ (counter advanced).
    let differ = false;
    for (let i = 0; i < 16; i++) {
        if (ks2[i] !== ks2[16 + i]) {
            differ = true;
            break;
        }
    }
    assert.ok(differ, `length=${length}: counter must advance between blocks`);
}

// --- Round-trips across wrap boundaries ---------------------------------------
//
// Decryption uses the same windowing; encrypt/decrypt must be inverses even when
// the message spans one or many wraps, including a non-byte-aligned width.

// length=8, counter near max -> wraps several times over 64 bytes (4 blocks/wrap).
{
    const counter = new Uint8Array(16).fill(0x11);
    counter[15] = 0xfe; // wraps after 2 blocks, then every 256 blocks
    const pt = crypto.getRandomValues(new Uint8Array(64));
    const ct = await enc(counter, 8, pt);
    assert.equal(ct.length, pt.length);
    assert.deepEqual(await dec(counter, 8, ct), pt, 'length=8 multi-wrap round-trip');
}

// length=4, non-byte-aligned, wraps every 16 blocks.
{
    const counter = new Uint8Array(16).fill(0x22);
    counter[15] = 0x0d; // low nibble near max -> wraps mid-message
    const pt = crypto.getRandomValues(new Uint8Array(48 + 7)); // partial final block
    const ct = await enc(counter, 4, pt);
    assert.equal(ct.length, pt.length);
    assert.deepEqual(await dec(counter, 4, ct), pt, 'length=4 non-aligned round-trip');

    // The high nibble of counter[15] and all nonce bytes must be untouched: a
    // round-trip with the nonce bits flipped must NOT reproduce the plaintext.
    const counterBadNonce = new Uint8Array(counter);
    counterBadNonce[14] ^= 0x01;
    const wrong = await dec(counterBadNonce, 4, ct);
    let same = true;
    for (let i = 0; i < pt.length; i++) {
        if (wrong[i] !== pt[i]) {
            same = false;
            break;
        }
    }
    assert.ok(!same, 'length=4: nonce participates in the keystream');
}

// length=128: full-width counter, single window. Counter at all-ones wraps the
// whole block to zero (no nonce to preserve) — must still round-trip.
{
    const counter = new Uint8Array(16).fill(0xff);
    const pt = crypto.getRandomValues(new Uint8Array(48));
    const ct = await enc(counter, 128, pt);
    assert.deepEqual(await dec(counter, 128, ct), pt, 'length=128 full-wrap round-trip');
}
