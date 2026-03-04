import assert from 'tjs:assert';

// 1. ECDSA generateKey + sign + verify round-trip (P-256, SHA-256)
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        [ 'sign', 'verify' ]
    );

    assert.ok(keyPair.publicKey, 'has publicKey');
    assert.ok(keyPair.privateKey, 'has privateKey');
    assert.eq(keyPair.publicKey.type, 'public', 'publicKey type');
    assert.eq(keyPair.privateKey.type, 'private', 'privateKey type');
    assert.eq(keyPair.publicKey.algorithm.name, 'ECDSA', 'publicKey algorithm');
    assert.eq(keyPair.publicKey.algorithm.namedCurve, 'P-256', 'publicKey curve');
    assert.eq(keyPair.privateKey.algorithm.namedCurve, 'P-256', 'privateKey curve');
    assert.eq(keyPair.publicKey.extractable, true, 'publicKey is extractable');

    const data = new TextEncoder().encode('hello ECDSA');
    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.privateKey,
        data
    );

    assert.ok(signature instanceof ArrayBuffer, 'signature is ArrayBuffer');
    assert.eq(signature.byteLength, 64, 'P-256 signature is 64 bytes');

    const valid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.publicKey,
        signature,
        data
    );

    assert.eq(valid, true, 'signature verifies');
}

// 2. ECDSA sign/verify with all curves
{
    const curves = [
        [ 'P-256', 'SHA-256', 64 ],
        [ 'P-384', 'SHA-384', 96 ],
        [ 'P-521', 'SHA-512', 132 ],
    ];

    for (const [curve, hash, sigLen] of curves) {
        const keyPair = await crypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: curve },
            false,
            [ 'sign', 'verify' ]
        );

        const data = new TextEncoder().encode(`test data for ${curve}`);
        const signature = await crypto.subtle.sign(
            { name: 'ECDSA', hash },
            keyPair.privateKey,
            data
        );

        assert.eq(signature.byteLength, sigLen, `${curve} signature is ${sigLen} bytes`);

        const valid = await crypto.subtle.verify(
            { name: 'ECDSA', hash },
            keyPair.publicKey,
            signature,
            data
        );

        assert.eq(valid, true, `${curve} signature verifies`);
    }
}

// 3. ECDSA verify with tampered data
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        [ 'sign', 'verify' ]
    );

    const data = new TextEncoder().encode('original data');
    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.privateKey,
        data
    );

    const tampered = new TextEncoder().encode('tampered data');
    const valid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.publicKey,
        signature,
        tampered
    );

    assert.eq(valid, false, 'tampered data fails verification');
}

// 4. ECDSA verify with tampered signature
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        [ 'sign', 'verify' ]
    );

    const data = new TextEncoder().encode('some data');
    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.privateKey,
        data
    );

    const sigBytes = new Uint8Array(signature);
    sigBytes[0] ^= 0xff;

    const valid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.publicKey,
        sigBytes,
        data
    );

    assert.eq(valid, false, 'tampered signature fails verification');
}

// 5. ECDSA importKey/exportKey raw public key round-trip
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        [ 'sign', 'verify' ]
    );

    const exported = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    assert.ok(exported instanceof ArrayBuffer, 'exported is ArrayBuffer');
    assert.eq(exported.byteLength, 65, 'P-256 raw public key is 65 bytes');
    assert.eq(new Uint8Array(exported)[0], 0x04, 'starts with 0x04');

    const imported = await crypto.subtle.importKey(
        'raw',
        exported,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        [ 'verify' ]
    );

    assert.eq(imported.type, 'public', 'imported key type');
    assert.eq(imported.algorithm.name, 'ECDSA', 'imported key algorithm');
    assert.eq(imported.algorithm.namedCurve, 'P-256', 'imported key curve');

    // Verify with imported key
    const data = new TextEncoder().encode('test import');
    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.privateKey,
        data
    );

    const valid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        imported,
        signature,
        data
    );

    assert.eq(valid, true, 'imported key verifies signature');
}

// 6. ECDH generateKey + deriveBits round-trip
{
    const keyPairA = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        [ 'deriveBits' ]
    );

    const keyPairB = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        [ 'deriveBits' ]
    );

    const sharedA = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: keyPairB.publicKey },
        keyPairA.privateKey,
        256
    );

    const sharedB = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: keyPairA.publicKey },
        keyPairB.privateKey,
        256
    );

    assert.ok(sharedA instanceof ArrayBuffer, 'sharedA is ArrayBuffer');
    assert.eq(sharedA.byteLength, 32, 'P-256 shared secret is 32 bytes');

    const a = new Uint8Array(sharedA);
    const b = new Uint8Array(sharedB);
    let equal = a.byteLength === b.byteLength;

    for (let i = 0; i < a.byteLength; i++) {
        if (a[i] !== b[i]) {
            equal = false;
        }
    }

    assert.eq(equal, true, 'both sides derive the same shared secret');
}

// 7. ECDH deriveBits with all curves
{
    const curves = [
        [ 'P-256', 256 ],
        [ 'P-384', 384 ],
        [ 'P-521', 528 ],
    ];

    for (const [curve, bits] of curves) {
        const keyPairA = await crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: curve },
            false,
            [ 'deriveBits' ]
        );

        const keyPairB = await crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: curve },
            false,
            [ 'deriveBits' ]
        );

        const shared = await crypto.subtle.deriveBits(
            { name: 'ECDH', public: keyPairB.publicKey },
            keyPairA.privateKey,
            bits
        );

        assert.eq(shared.byteLength, bits / 8, `${curve} shared secret is ${bits / 8} bytes`);
    }
}

// 8. ECDH deriveKey → AES-GCM-256
{
    const keyPairA = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        [ 'deriveKey' ]
    );

    const keyPairB = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        [ 'deriveKey' ]
    );

    const aesKey = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: keyPairB.publicKey },
        keyPairA.privateKey,
        { name: 'AES-GCM', length: 256 },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    assert.eq(aesKey.type, 'secret', 'derived key type');
    assert.eq(aesKey.algorithm.name, 'AES-GCM', 'derived key algorithm');
    assert.eq(aesKey.algorithm.length, 256, 'derived key length');

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode('hello from ECDH');
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
    const decoded = new TextDecoder().decode(decrypted);
    assert.eq(decoded, 'hello from ECDH', 'ECDH derived AES-GCM key round-trips');
}

// 9. ECDH importKey/exportKey raw public key round-trip
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        [ 'deriveBits' ]
    );

    const exported = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    assert.ok(exported instanceof ArrayBuffer, 'exported is ArrayBuffer');
    assert.eq(exported.byteLength, 65, 'P-256 raw public key is 65 bytes');

    const imported = await crypto.subtle.importKey(
        'raw',
        exported,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        []
    );

    assert.eq(imported.type, 'public', 'imported key type');
    assert.eq(imported.algorithm.name, 'ECDH', 'imported key algorithm');
}

// 10. Error: ECDSA sign with public key
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        [ 'sign', 'verify' ]
    );

    try {
        await crypto.subtle.sign(
            { name: 'ECDSA', hash: 'SHA-256' },
            keyPair.publicKey,
            new Uint8Array(10)
        );
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'InvalidAccessError', 'sign with public key throws InvalidAccessError');
    }
}

// 11. Error: ECDSA verify with private key
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        [ 'sign', 'verify' ]
    );

    try {
        await crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            keyPair.privateKey,
            new Uint8Array(64),
            new Uint8Array(10)
        );
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'InvalidAccessError', 'verify with private key throws InvalidAccessError');
    }
}

// 12. Error: ECDSA generateKey with invalid usage
{
    try {
        await crypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            [ 'encrypt' ]
        );
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'SyntaxError', 'invalid usage throws SyntaxError');
    }
}

// 13. Error: ECDH deriveBits with mismatched curves
{
    const keyPairA = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        [ 'deriveBits' ]
    );

    const keyPairB = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-384' },
        false,
        [ 'deriveBits' ]
    );

    try {
        await crypto.subtle.deriveBits(
            { name: 'ECDH', public: keyPairB.publicKey },
            keyPairA.privateKey,
            256
        );
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'InvalidAccessError', 'mismatched curves throws InvalidAccessError');
    }
}

// 14. Error: ECDH deriveBits with length not multiple of 8
{
    const keyPairA = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        [ 'deriveBits' ]
    );

    const keyPairB = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        [ 'deriveBits' ]
    );

    try {
        await crypto.subtle.deriveBits(
            { name: 'ECDH', public: keyPairB.publicKey },
            keyPairA.privateKey,
            100
        );
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'OperationError', 'non-multiple of 8 throws OperationError');
    }
}

// 15. Error: importKey raw with wrong byte length
{
    try {
        await crypto.subtle.importKey(
            'raw',
            new Uint8Array(10),
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            [ 'verify' ]
        );
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'DataError', 'wrong byte length throws DataError');
    }
}

// 16. Error: exportKey raw on private key
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        [ 'sign', 'verify' ]
    );

    try {
        await crypto.subtle.exportKey('raw', keyPair.privateKey);
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'InvalidAccessError', 'export private key throws InvalidAccessError');
    }
}
