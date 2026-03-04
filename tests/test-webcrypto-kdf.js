import assert from 'tjs:assert';

function toHex(buffer) {
    return [ ...new Uint8Array(buffer) ].map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
    const bytes = new Uint8Array(hex.length / 2);

    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }

    return bytes;
}

// 1. PBKDF2 importKey + deriveBits — RFC 6070 test vector
{
    const password = new TextEncoder().encode('password');
    const key = await crypto.subtle.importKey(
        'raw',
        password,
        'PBKDF2',
        false,
        [ 'deriveBits' ]
    );

    assert.eq(key.type, 'secret', 'PBKDF2 key type is secret');
    assert.eq(key.algorithm.name, 'PBKDF2', 'algorithm name is PBKDF2');
    assert.eq(key.extractable, false, 'PBKDF2 key is not extractable');

    const salt = new TextEncoder().encode('salt');
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-1', salt, iterations: 4096 },
        key,
        160
    );

    assert.ok(bits instanceof ArrayBuffer, 'deriveBits returns ArrayBuffer');
    assert.eq(bits.byteLength, 20, 'output is 20 bytes');
    assert.eq(toHex(bits), '4b007901b765489abead49d926f721d065a429c1', 'RFC 6070 test vector matches');
}

// 2. PBKDF2 deriveBits with all hash algorithms
{
    const password = new TextEncoder().encode('test-password');
    const key = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, [ 'deriveBits' ]);
    const salt = new TextEncoder().encode('test-salt');

    for (const [hash, expectedLen] of [ [ 'SHA-1', 20 ], [ 'SHA-256', 32 ], [ 'SHA-384', 48 ], [ 'SHA-512', 64 ] ]) {
        const bits = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', hash, salt, iterations: 1000 },
            key,
            expectedLen * 8
        );
        assert.eq(bits.byteLength, expectedLen, `PBKDF2-${hash} output is ${expectedLen} bytes`);
    }
}

// 3. PBKDF2 deriveKey → AES-GCM-256 key — verify encrypt/decrypt
{
    const password = new TextEncoder().encode('my-password');
    const key = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, [ 'deriveKey' ]);
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const aesKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 10000 },
        key,
        { name: 'AES-GCM', length: 256 },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    assert.eq(aesKey.type, 'secret', 'derived key type is secret');
    assert.eq(aesKey.algorithm.name, 'AES-GCM', 'derived key algorithm is AES-GCM');
    assert.eq(aesKey.algorithm.length, 256, 'derived key length is 256');

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode('hello from PBKDF2');
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
    const decoded = new TextDecoder().decode(decrypted);
    assert.eq(decoded, 'hello from PBKDF2', 'PBKDF2 derived AES-GCM key round-trips');
}

// 4. HKDF importKey + deriveBits — RFC 5869 Test Case 1
{
    const ikm = fromHex('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b');
    const salt = fromHex('000102030405060708090a0b0c');
    const info = fromHex('f0f1f2f3f4f5f6f7f8f9');

    const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, [ 'deriveBits' ]);

    assert.eq(key.type, 'secret', 'HKDF key type is secret');
    assert.eq(key.algorithm.name, 'HKDF', 'algorithm name is HKDF');
    assert.eq(key.extractable, false, 'HKDF key is not extractable');

    const bits = await crypto.subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt, info },
        key,
        42 * 8
    );

    assert.ok(bits instanceof ArrayBuffer, 'deriveBits returns ArrayBuffer');
    assert.eq(bits.byteLength, 42, 'output is 42 bytes');
    assert.eq(
        toHex(bits),
        '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865',
        'RFC 5869 Test Case 1 matches'
    );
}

// 5. HKDF deriveBits with all hash algorithms
{
    const ikm = crypto.getRandomValues(new Uint8Array(32));
    const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, [ 'deriveBits' ]);
    const salt = new Uint8Array(16);
    const info = new Uint8Array(0);

    for (const [hash, len] of [ [ 'SHA-1', 20 ], [ 'SHA-256', 32 ], [ 'SHA-384', 48 ], [ 'SHA-512', 64 ] ]) {
        const bits = await crypto.subtle.deriveBits(
            { name: 'HKDF', hash, salt, info },
            key,
            len * 8
        );
        assert.eq(bits.byteLength, len, `HKDF-${hash} output is ${len} bytes`);
    }
}

// 6. HKDF deriveKey → AES-CBC-128 key — verify encrypt/decrypt
{
    const ikm = crypto.getRandomValues(new Uint8Array(32));
    const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, [ 'deriveKey' ]);
    const salt = new Uint8Array(16);
    const info = new TextEncoder().encode('aes-key');

    const aesKey = await crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt, info },
        key,
        { name: 'AES-CBC', length: 128 },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    assert.eq(aesKey.type, 'secret', 'derived key type is secret');
    assert.eq(aesKey.algorithm.name, 'AES-CBC', 'derived key algorithm is AES-CBC');
    assert.eq(aesKey.algorithm.length, 128, 'derived key length is 128');

    const iv = crypto.getRandomValues(new Uint8Array(16));
    const plaintext = new TextEncoder().encode('hello from HKDF');
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, aesKey, plaintext);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, aesKey, ciphertext);
    const decoded = new TextDecoder().decode(decrypted);
    assert.eq(decoded, 'hello from HKDF', 'HKDF derived AES-CBC key round-trips');
}

// 7. Error: PBKDF2/HKDF importKey with extractable: true → SyntaxError
{
    const data = new Uint8Array(16);

    try {
        await crypto.subtle.importKey('raw', data, 'PBKDF2', true, [ 'deriveBits' ]);
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'SyntaxError', 'PBKDF2 extractable throws SyntaxError');
    }

    try {
        await crypto.subtle.importKey('raw', data, 'HKDF', true, [ 'deriveBits' ]);
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'SyntaxError', 'HKDF extractable throws SyntaxError');
    }
}

// 8. Error: importKey with invalid usage
{
    const data = new Uint8Array(16);

    try {
        await crypto.subtle.importKey('raw', data, 'PBKDF2', false, [ 'sign' ]);
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'SyntaxError', 'invalid usage throws SyntaxError');
    }
}

// 9. Error: deriveBits with wrong key algorithm
{
    const hmacKey = await crypto.subtle.generateKey(
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        [ 'sign' ]
    );

    try {
        await crypto.subtle.deriveBits(
            { name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(16), iterations: 1000 },
            hmacKey,
            256
        );
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'InvalidAccessError', 'wrong key algorithm throws InvalidAccessError');
    }
}

// 10. Error: deriveBits with length not multiple of 8
{
    const key = await crypto.subtle.importKey(
        'raw', new Uint8Array(16), 'PBKDF2', false, [ 'deriveBits' ]
    );

    try {
        await crypto.subtle.deriveBits(
            { name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(8), iterations: 1000 },
            key,
            100
        );
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'OperationError', 'non-multiple of 8 throws OperationError');
    }
}

// 11. Error: PBKDF2 with iterations=0
{
    const key = await crypto.subtle.importKey(
        'raw', new Uint8Array(16), 'PBKDF2', false, [ 'deriveBits' ]
    );

    try {
        await crypto.subtle.deriveBits(
            { name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(8), iterations: 0 },
            key,
            256
        );
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'OperationError', 'iterations=0 throws OperationError');
    }
}

// 12. Error: exportKey on PBKDF2/HKDF key
{
    const pbkdf2Key = await crypto.subtle.importKey(
        'raw', new Uint8Array(16), 'PBKDF2', false, [ 'deriveBits' ]
    );

    try {
        await crypto.subtle.exportKey('raw', pbkdf2Key);
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'InvalidAccessError', 'PBKDF2 exportKey throws InvalidAccessError');
    }

    const hkdfKey = await crypto.subtle.importKey(
        'raw', new Uint8Array(16), 'HKDF', false, [ 'deriveBits' ]
    );

    try {
        await crypto.subtle.exportKey('raw', hkdfKey);
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'InvalidAccessError', 'HKDF exportKey throws InvalidAccessError');
    }
}
