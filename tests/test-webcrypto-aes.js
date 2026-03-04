import assert from 'tjs:assert';

// Helper to convert hex string to Uint8Array.
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);

    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }

    return bytes;
}

// Helper to convert Uint8Array to hex string.
function bytesToHex(bytes) {
    return Array.from(new Uint8Array(bytes))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// 1. AES-CBC-128 generateKey + encrypt + decrypt round-trip
{
    const key = await crypto.subtle.generateKey(
        { name: 'AES-CBC', length: 128 },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    assert.eq(key.type, 'secret', 'key type is secret');
    assert.eq(key.algorithm.name, 'AES-CBC', 'algorithm name is AES-CBC');
    assert.eq(key.algorithm.length, 128, 'key length is 128');
    assert.eq(key.extractable, true, 'key is extractable');
    assert.ok(key.usages.includes('encrypt'), 'key has encrypt usage');
    assert.ok(key.usages.includes('decrypt'), 'key has decrypt usage');

    const iv = crypto.getRandomValues(new Uint8Array(16));
    const plaintext = new TextEncoder().encode('hello world AES-CBC');

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-CBC', iv },
        key,
        plaintext
    );

    assert.ok(ciphertext instanceof ArrayBuffer, 'ciphertext is ArrayBuffer');
    assert.ok(ciphertext.byteLength > plaintext.byteLength, 'ciphertext is longer due to padding');

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-CBC', iv },
        key,
        ciphertext
    );

    assert.ok(decrypted instanceof ArrayBuffer, 'decrypted is ArrayBuffer');
    const decryptedText = new TextDecoder().decode(decrypted);
    assert.eq(decryptedText, 'hello world AES-CBC', 'decrypted matches plaintext');
}

// 2. AES-CBC all key sizes (128, 192, 256)
for (const length of [ 128, 192, 256 ]) {
    const key = await crypto.subtle.generateKey(
        { name: 'AES-CBC', length },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    assert.eq(key.algorithm.length, length, `key length is ${length}`);

    const exported = await crypto.subtle.exportKey('raw', key);
    assert.eq(exported.byteLength, length / 8, `exported key is ${length / 8} bytes`);

    const iv = crypto.getRandomValues(new Uint8Array(16));
    const plaintext = new TextEncoder().encode(`test ${length}`);

    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, plaintext);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, ciphertext);

    assert.eq(new TextDecoder().decode(decrypted), `test ${length}`, `AES-CBC-${length} round-trip`);
}

// 3. AES-CBC importKey / exportKey round-trip
{
    const rawKey = new Uint8Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ]);
    const key = await crypto.subtle.importKey(
        'raw',
        rawKey,
        'AES-CBC',
        true,
        [ 'encrypt', 'decrypt' ]
    );

    assert.eq(key.type, 'secret');
    assert.eq(key.algorithm.name, 'AES-CBC');
    assert.eq(key.algorithm.length, 128);
    assert.eq(key.extractable, true);

    const exported = await crypto.subtle.exportKey('raw', key);
    assert.ok(exported instanceof ArrayBuffer, 'exported is ArrayBuffer');

    const exportedBytes = new Uint8Array(exported);
    assert.eq(exportedBytes.length, rawKey.length, 'exported key same length');

    for (let i = 0; i < rawKey.length; i++) {
        assert.eq(exportedBytes[i], rawKey[i], `byte ${i} matches`);
    }
}

// 4. AES-CBC NIST SP 800-38A F.2.1 known test vector (AES-128-CBC encrypt)
{
    const keyBytes = hexToBytes('2b7e151628aed2a6abf7158809cf4f3c');
    const iv = hexToBytes('000102030405060708090a0b0c0d0e0f');
    const plaintext = hexToBytes('6bc1bee22e409f96e93d7e117393172a');

    const key = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        'AES-CBC',
        false,
        [ 'encrypt' ]
    );

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-CBC', iv },
        key,
        plaintext
    );

    const ctBytes = new Uint8Array(ciphertext);
    // NIST expected output for the first block is 7649abac8119b246cee98e9b12e9197d
    // With PKCS7 padding, there's an extra block, so we check the first 16 bytes.
    const firstBlock = bytesToHex(ctBytes.slice(0, 16));
    assert.eq(firstBlock, '7649abac8119b246cee98e9b12e9197d', 'NIST F.2.1 test vector matches');
}

// 5. AES-GCM-256 generateKey + encrypt + decrypt round-trip
{
    const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    assert.eq(key.algorithm.name, 'AES-GCM', 'algorithm name is AES-GCM');
    assert.eq(key.algorithm.length, 256, 'key length is 256');

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode('hello world AES-GCM');

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        plaintext
    );

    assert.ok(ciphertext instanceof ArrayBuffer, 'ciphertext is ArrayBuffer');
    // Default tag is 16 bytes (128 bits).
    assert.eq(ciphertext.byteLength, plaintext.byteLength + 16, 'ciphertext = plaintext + 16-byte tag');

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
    );

    const decryptedText = new TextDecoder().decode(decrypted);
    assert.eq(decryptedText, 'hello world AES-GCM', 'decrypted matches plaintext');
}

// 6. AES-GCM with additionalData (AAD) — correct AAD succeeds, wrong AAD fails
{
    const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 128 },
        false,
        [ 'encrypt', 'decrypt' ]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode('authenticated data');
    const aad = new TextEncoder().encode('additional auth');

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: aad },
        key,
        plaintext
    );

    // Correct AAD succeeds.
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData: aad },
        key,
        ciphertext
    );

    assert.eq(new TextDecoder().decode(decrypted), 'authenticated data', 'AAD decrypt succeeds');

    // Wrong AAD fails.
    const wrongAad = new TextEncoder().encode('wrong auth data');

    try {
        await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv, additionalData: wrongAad },
            key,
            ciphertext
        );
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.ok(e instanceof DOMException, 'error is DOMException');
        assert.eq(e.name, 'OperationError', 'wrong AAD gives OperationError');
    }
}

// 7. AES-GCM different tag lengths
{
    const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 128 },
        false,
        [ 'encrypt', 'decrypt' ]
    );

    for (const tagLength of [ 96, 104, 112, 120, 128 ]) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const plaintext = new TextEncoder().encode(`tag ${tagLength}`);

        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv, tagLength },
            key,
            plaintext
        );

        assert.eq(
            ciphertext.byteLength,
            plaintext.byteLength + tagLength / 8,
            `tag ${tagLength}: ciphertext size correct`
        );

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv, tagLength },
            key,
            ciphertext
        );

        assert.eq(new TextDecoder().decode(decrypted), `tag ${tagLength}`, `tag ${tagLength}: round-trip`);
    }
}

// 8. AES-GCM tampered ciphertext — OperationError
{
    const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 128 },
        false,
        [ 'encrypt', 'decrypt' ]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode('tamper test');

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        plaintext
    );

    const tampered = new Uint8Array(ciphertext);
    tampered[0] ^= 0xff;

    try {
        await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            tampered
        );
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.ok(e instanceof DOMException, 'error is DOMException');
        assert.eq(e.name, 'OperationError', 'tampered ciphertext gives OperationError');
    }
}

// 9. Invalid CBC IV length (not 16) — error
{
    const key = await crypto.subtle.generateKey(
        { name: 'AES-CBC', length: 128 },
        false,
        [ 'encrypt' ]
    );

    try {
        await crypto.subtle.encrypt(
            { name: 'AES-CBC', iv: new Uint8Array(12) },
            key,
            new Uint8Array([ 1, 2, 3 ])
        );
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.ok(e instanceof DOMException, 'error is DOMException');
        assert.eq(e.name, 'OperationError', 'wrong IV length gives OperationError');
    }
}

// 10. Invalid importKey key length (not 16/24/32) — DataError
{
    try {
        await crypto.subtle.importKey(
            'raw',
            new Uint8Array(10),
            'AES-CBC',
            false,
            [ 'encrypt' ]
        );
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.ok(e instanceof DOMException, 'error is DOMException');
        assert.eq(e.name, 'DataError', 'invalid key length gives DataError');
    }
}

// 11. Non-extractable key export — InvalidAccessError
{
    const key = await crypto.subtle.generateKey(
        { name: 'AES-CBC', length: 128 },
        false,
        [ 'encrypt' ]
    );

    assert.eq(key.extractable, false);

    try {
        await crypto.subtle.exportKey('raw', key);
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.ok(e instanceof DOMException, 'error is DOMException');
        assert.eq(e.name, 'InvalidAccessError', 'non-extractable export gives InvalidAccessError');
    }
}

// 12. Wrong usage (decrypt key used for encrypt) — InvalidAccessError
{
    const key = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(16),
        'AES-CBC',
        false,
        [ 'decrypt' ]  // only decrypt, not encrypt
    );

    try {
        await crypto.subtle.encrypt(
            { name: 'AES-CBC', iv: new Uint8Array(16) },
            key,
            new Uint8Array([ 1, 2, 3 ])
        );
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.ok(e instanceof DOMException, 'error is DOMException');
        assert.eq(e.name, 'InvalidAccessError', 'wrong usage gives InvalidAccessError');
    }
}
