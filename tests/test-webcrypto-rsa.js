import assert from 'tjs:assert';

// 1. RSA-OAEP generateKey + encrypt + decrypt round-trip (2048, SHA-256)
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    assert.ok(keyPair.publicKey, 'has publicKey');
    assert.ok(keyPair.privateKey, 'has privateKey');
    assert.eq(keyPair.publicKey.type, 'public', 'publicKey type');
    assert.eq(keyPair.privateKey.type, 'private', 'privateKey type');
    assert.eq(keyPair.publicKey.algorithm.name, 'RSA-OAEP', 'publicKey algorithm');
    assert.eq(keyPair.publicKey.algorithm.modulusLength, 2048, 'modulusLength');
    assert.eq(keyPair.publicKey.algorithm.hash.name, 'SHA-256', 'hash algorithm');
    assert.eq(keyPair.publicKey.extractable, true, 'publicKey is extractable');

    const data = new TextEncoder().encode('hello RSA-OAEP');
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        keyPair.publicKey,
        data
    );

    assert.ok(ciphertext instanceof ArrayBuffer, 'ciphertext is ArrayBuffer');
    assert.eq(ciphertext.byteLength, 256, '2048-bit RSA produces 256-byte ciphertext');

    const plaintext = await crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        keyPair.privateKey,
        ciphertext
    );

    const decoded = new TextDecoder().decode(plaintext);
    assert.eq(decoded, 'hello RSA-OAEP', 'decrypt recovers plaintext');
}

// 2. RSA-OAEP with all hash algorithms
{
    const hashes = [ 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512' ];

    for (const hash of hashes) {
        const keyPair = await crypto.subtle.generateKey(
            { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash },
            false,
            [ 'encrypt', 'decrypt' ]
        );

        const data = new TextEncoder().encode(`test ${hash}`);
        const ciphertext = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, keyPair.publicKey, data);
        const plaintext = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, keyPair.privateKey, ciphertext);
        const decoded = new TextDecoder().decode(plaintext);
        assert.eq(decoded, `test ${hash}`, `RSA-OAEP with ${hash} round-trips`);
    }
}

// 3. RSA-OAEP with optional label
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        false,
        [ 'encrypt', 'decrypt' ]
    );

    const label = new TextEncoder().encode('my-label');
    const data = new TextEncoder().encode('labeled data');
    const ciphertext = await crypto.subtle.encrypt({ name: 'RSA-OAEP', label }, keyPair.publicKey, data);
    const plaintext = await crypto.subtle.decrypt({ name: 'RSA-OAEP', label }, keyPair.privateKey, ciphertext);
    const decoded = new TextDecoder().decode(plaintext);
    assert.eq(decoded, 'labeled data', 'RSA-OAEP with label round-trips');
}

// 4. RSA-OAEP decrypt with wrong key fails
{
    const keyPair1 = await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        false,
        [ 'encrypt', 'decrypt' ]
    );

    const keyPair2 = await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        false,
        [ 'encrypt', 'decrypt' ]
    );

    const data = new TextEncoder().encode('secret');
    const ciphertext = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, keyPair1.publicKey, data);

    try {
        await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, keyPair2.privateKey, ciphertext);
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'OperationError', 'wrong key decrypt throws OperationError');
    }
}

// 5. RSA-PSS generateKey + sign + verify round-trip (2048, SHA-256)
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-PSS', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        true,
        [ 'sign', 'verify' ]
    );

    assert.eq(keyPair.publicKey.algorithm.name, 'RSA-PSS', 'RSA-PSS algorithm');
    assert.eq(keyPair.publicKey.algorithm.modulusLength, 2048, 'modulusLength');
    assert.eq(keyPair.publicKey.algorithm.hash.name, 'SHA-256', 'hash');

    const data = new TextEncoder().encode('hello RSA-PSS');
    const signature = await crypto.subtle.sign(
        { name: 'RSA-PSS', saltLength: 32 },
        keyPair.privateKey,
        data
    );

    assert.ok(signature instanceof ArrayBuffer, 'signature is ArrayBuffer');
    assert.eq(signature.byteLength, 256, '2048-bit RSA produces 256-byte signature');

    const valid = await crypto.subtle.verify(
        { name: 'RSA-PSS', saltLength: 32 },
        keyPair.publicKey,
        signature,
        data
    );

    assert.eq(valid, true, 'RSA-PSS signature verifies');
}

// 6. RSA-PSS with different hash algorithms
{
    const hashes = [ 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512' ];

    for (const hash of hashes) {
        const keyPair = await crypto.subtle.generateKey(
            { name: 'RSA-PSS', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash },
            false,
            [ 'sign', 'verify' ]
        );

        const data = new TextEncoder().encode(`test ${hash}`);
        const signature = await crypto.subtle.sign({ name: 'RSA-PSS', saltLength: 20 }, keyPair.privateKey, data);
        const valid = await crypto.subtle.verify({ name: 'RSA-PSS', saltLength: 20 }, keyPair.publicKey, signature, data);
        assert.eq(valid, true, `RSA-PSS with ${hash} verifies`);
    }
}

// 7. RSA-PSS verify with tampered data
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-PSS', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        false,
        [ 'sign', 'verify' ]
    );

    const data = new TextEncoder().encode('original data');
    const signature = await crypto.subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, keyPair.privateKey, data);
    const tampered = new TextEncoder().encode('tampered data');
    const valid = await crypto.subtle.verify({ name: 'RSA-PSS', saltLength: 32 }, keyPair.publicKey, signature, tampered);
    assert.eq(valid, false, 'tampered data fails RSA-PSS verification');
}

// 8. RSA-PSS verify with tampered signature
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-PSS', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        false,
        [ 'sign', 'verify' ]
    );

    const data = new TextEncoder().encode('some data');
    const signature = await crypto.subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, keyPair.privateKey, data);
    const sigBytes = new Uint8Array(signature);
    sigBytes[0] ^= 0xff;
    const valid = await crypto.subtle.verify({ name: 'RSA-PSS', saltLength: 32 }, keyPair.publicKey, sigBytes, data);
    assert.eq(valid, false, 'tampered signature fails RSA-PSS verification');
}

// 9. RSA-PSS with different saltLength values
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-PSS', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        false,
        [ 'sign', 'verify' ]
    );

    for (const saltLength of [ 0, 32 ]) {
        const data = new TextEncoder().encode(`salt ${saltLength}`);
        const signature = await crypto.subtle.sign({ name: 'RSA-PSS', saltLength }, keyPair.privateKey, data);
        const valid = await crypto.subtle.verify({ name: 'RSA-PSS', saltLength }, keyPair.publicKey, signature, data);
        assert.eq(valid, true, `RSA-PSS with saltLength=${saltLength} verifies`);
    }
}

// 10. RSASSA-PKCS1-v1_5 generateKey + sign + verify round-trip (2048, SHA-256)
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        true,
        [ 'sign', 'verify' ]
    );

    assert.eq(keyPair.publicKey.algorithm.name, 'RSASSA-PKCS1-v1_5', 'PKCS1v15 algorithm');

    const data = new TextEncoder().encode('hello PKCS1v15');
    const signature = await crypto.subtle.sign(
        { name: 'RSASSA-PKCS1-v1_5' },
        keyPair.privateKey,
        data
    );

    assert.ok(signature instanceof ArrayBuffer, 'signature is ArrayBuffer');
    assert.eq(signature.byteLength, 256, '2048-bit RSA produces 256-byte signature');

    const valid = await crypto.subtle.verify(
        { name: 'RSASSA-PKCS1-v1_5' },
        keyPair.publicKey,
        signature,
        data
    );

    assert.eq(valid, true, 'RSASSA-PKCS1-v1_5 signature verifies');
}

// 11. RSASSA-PKCS1-v1_5 verify tampered data
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        false,
        [ 'sign', 'verify' ]
    );

    const data = new TextEncoder().encode('original');
    const signature = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, keyPair.privateKey, data);
    const tampered = new TextEncoder().encode('tampered');
    const valid = await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, keyPair.publicKey, signature, tampered);
    assert.eq(valid, false, 'tampered data fails PKCS1v15 verification');
}

// 12. importKey/exportKey spki round-trip (RSA-OAEP)
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    const exported = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    assert.ok(exported instanceof ArrayBuffer, 'exported is ArrayBuffer');

    const imported = await crypto.subtle.importKey(
        'spki',
        exported,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        [ 'encrypt' ]
    );

    assert.eq(imported.type, 'public', 'imported key type');
    assert.eq(imported.algorithm.name, 'RSA-OAEP', 'imported key algorithm');
    assert.eq(imported.algorithm.modulusLength, 2048, 'imported modulusLength');
    assert.eq(imported.algorithm.hash.name, 'SHA-256', 'imported hash');

    // Encrypt with imported key, decrypt with original private key
    const data = new TextEncoder().encode('test import');
    const ciphertext = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, imported, data);
    const plaintext = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, keyPair.privateKey, ciphertext);
    const decoded = new TextDecoder().decode(plaintext);
    assert.eq(decoded, 'test import', 'imported key works for encryption');
}

// 13. importKey/exportKey pkcs8 round-trip (RSA-OAEP)
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    const exported = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    assert.ok(exported instanceof ArrayBuffer, 'exported is ArrayBuffer');

    const imported = await crypto.subtle.importKey(
        'pkcs8',
        exported,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        [ 'decrypt' ]
    );

    assert.eq(imported.type, 'private', 'imported key type');
    assert.eq(imported.algorithm.name, 'RSA-OAEP', 'imported key algorithm');
    assert.eq(imported.algorithm.modulusLength, 2048, 'imported modulusLength');

    // Encrypt with original public key, decrypt with imported private key
    const data = new TextEncoder().encode('test pkcs8');
    const ciphertext = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, keyPair.publicKey, data);
    const plaintext = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, imported, ciphertext);
    const decoded = new TextDecoder().decode(plaintext);
    assert.eq(decoded, 'test pkcs8', 'imported private key works for decryption');
}

// 14. importKey/exportKey round-trip (RSA-PSS)
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-PSS', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        true,
        [ 'sign', 'verify' ]
    );

    const exportedPub = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const exportedPriv = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    const importedPub = await crypto.subtle.importKey(
        'spki', exportedPub, { name: 'RSA-PSS', hash: 'SHA-256' }, true, [ 'verify' ]
    );
    const importedPriv = await crypto.subtle.importKey(
        'pkcs8', exportedPriv, { name: 'RSA-PSS', hash: 'SHA-256' }, true, [ 'sign' ]
    );

    const data = new TextEncoder().encode('test RSA-PSS import');
    const signature = await crypto.subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, importedPriv, data);
    const valid = await crypto.subtle.verify({ name: 'RSA-PSS', saltLength: 32 }, importedPub, signature, data);
    assert.eq(valid, true, 'imported RSA-PSS keys work');
}

// 15. Error: encrypt with private key
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        false,
        [ 'encrypt', 'decrypt' ]
    );

    try {
        await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, keyPair.privateKey, new Uint8Array(10));
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'InvalidAccessError', 'encrypt with private key throws InvalidAccessError');
    }
}

// 16. Error: decrypt with public key
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        false,
        [ 'encrypt', 'decrypt' ]
    );

    try {
        await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, keyPair.publicKey, new Uint8Array(256));
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'InvalidAccessError', 'decrypt with public key throws InvalidAccessError');
    }
}

// 17. Error: sign with public key
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-PSS', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        false,
        [ 'sign', 'verify' ]
    );

    try {
        await crypto.subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, keyPair.publicKey, new Uint8Array(10));
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'InvalidAccessError', 'sign with public key throws InvalidAccessError');
    }
}

// 18. Error: verify with private key
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-PSS', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        false,
        [ 'sign', 'verify' ]
    );

    try {
        await crypto.subtle.verify(
            { name: 'RSA-PSS', saltLength: 32 },
            keyPair.privateKey,
            new Uint8Array(256),
            new Uint8Array(10)
        );
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'InvalidAccessError', 'verify with private key throws InvalidAccessError');
    }
}

// 19. Error: generateKey with invalid usage
{
    try {
        await crypto.subtle.generateKey(
            { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
            false,
            [ 'sign' ]
        );
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'SyntaxError', 'invalid usage throws SyntaxError');
    }
}

// 20. Error: non-extractable key export
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        false,
        [ 'encrypt', 'decrypt' ]
    );

    try {
        await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'InvalidAccessError', 'non-extractable export throws InvalidAccessError');
    }
}

// 21. Error: unsupported export format
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    try {
        await crypto.subtle.exportKey('raw', keyPair.publicKey);
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'NotSupportedError', 'unsupported format throws NotSupportedError');
    }
}
