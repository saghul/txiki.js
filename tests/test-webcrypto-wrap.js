import assert from 'tjs:assert';

// 1. AES-GCM wrap/unwrap HMAC key (raw format)
{
    const wrappingKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        [ 'wrapKey', 'unwrapKey' ]
    );

    const hmacKey = await crypto.subtle.generateKey(
        { name: 'HMAC', hash: 'SHA-256' },
        true,
        [ 'sign', 'verify' ]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const wrapped = await crypto.subtle.wrapKey('raw', hmacKey, wrappingKey, { name: 'AES-GCM', iv });

    assert.ok(wrapped instanceof ArrayBuffer, 'wrapped is ArrayBuffer');
    assert.ok(wrapped.byteLength > 0, 'wrapped has data');

    const unwrapped = await crypto.subtle.unwrapKey(
        'raw', wrapped, wrappingKey,
        { name: 'AES-GCM', iv },
        { name: 'HMAC', hash: 'SHA-256' },
        true,
        [ 'sign', 'verify' ]
    );

    assert.eq(unwrapped.type, 'secret', 'unwrapped key type');
    assert.eq(unwrapped.algorithm.name, 'HMAC', 'unwrapped algorithm');

    // Verify the unwrapped key works: sign and verify
    const data = new TextEncoder().encode('test data');
    const sig = await crypto.subtle.sign('HMAC', unwrapped, data);
    const valid = await crypto.subtle.verify('HMAC', unwrapped, sig, data);

    assert.ok(valid, 'unwrapped HMAC key works for sign/verify');
}

// 2. AES-CBC wrap/unwrap AES key (raw format)
{
    const wrappingKey = await crypto.subtle.generateKey(
        { name: 'AES-CBC', length: 256 },
        true,
        [ 'wrapKey', 'unwrapKey' ]
    );

    const innerKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 128 },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    const iv = crypto.getRandomValues(new Uint8Array(16));

    const wrapped = await crypto.subtle.wrapKey('raw', innerKey, wrappingKey, { name: 'AES-CBC', iv });

    assert.ok(wrapped instanceof ArrayBuffer, 'wrapped is ArrayBuffer');

    const unwrapped = await crypto.subtle.unwrapKey(
        'raw', wrapped, wrappingKey,
        { name: 'AES-CBC', iv },
        { name: 'AES-GCM', length: 128 },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    assert.eq(unwrapped.algorithm.name, 'AES-GCM', 'unwrapped algorithm');
    assert.eq(unwrapped.algorithm.length, 128, 'unwrapped key length');

    // Verify round-trip: export both and compare
    const origRaw = await crypto.subtle.exportKey('raw', innerKey);
    const unwrappedRaw = await crypto.subtle.exportKey('raw', unwrapped);
    const origBytes = new Uint8Array(origRaw);
    const unwrappedBytes = new Uint8Array(unwrappedRaw);

    assert.eq(origBytes.length, unwrappedBytes.length, 'key lengths match');

    for (let i = 0; i < origBytes.length; i++) {
        assert.eq(origBytes[i], unwrappedBytes[i], `byte ${i} matches`);
    }
}

// 3. RSA-OAEP wrap/unwrap AES key (raw format)
{
    const rsaKeyPair = await crypto.subtle.generateKey(
        {
            name: 'RSA-OAEP',
            modulusLength: 2048,
            publicExponent: new Uint8Array([ 1, 0, 1 ]),
            hash: 'SHA-256',
        },
        true,
        [ 'wrapKey', 'unwrapKey' ]
    );

    const aesKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    const wrapped = await crypto.subtle.wrapKey('raw', aesKey, rsaKeyPair.publicKey, { name: 'RSA-OAEP' });

    assert.ok(wrapped instanceof ArrayBuffer, 'RSA-wrapped is ArrayBuffer');
    assert.eq(wrapped.byteLength, 256, 'RSA-wrapped length matches modulus size');

    const unwrapped = await crypto.subtle.unwrapKey(
        'raw', wrapped, rsaKeyPair.privateKey,
        { name: 'RSA-OAEP' },
        { name: 'AES-GCM', length: 256 },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    assert.eq(unwrapped.algorithm.name, 'AES-GCM', 'unwrapped algorithm');
    assert.eq(unwrapped.algorithm.length, 256, 'unwrapped key length');

    // Verify key material matches
    const origRaw = await crypto.subtle.exportKey('raw', aesKey);
    const unwrappedRaw = await crypto.subtle.exportKey('raw', unwrapped);
    const origBytes = new Uint8Array(origRaw);
    const unwrappedBytes = new Uint8Array(unwrappedRaw);

    assert.eq(origBytes.length, unwrappedBytes.length, 'RSA wrap: key lengths match');

    for (let i = 0; i < origBytes.length; i++) {
        assert.eq(origBytes[i], unwrappedBytes[i], `RSA wrap: byte ${i} matches`);
    }
}

// 4. AES-GCM wrap/unwrap with JWK format
{
    const wrappingKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        [ 'wrapKey', 'unwrapKey' ]
    );

    const hmacKey = await crypto.subtle.generateKey(
        { name: 'HMAC', hash: 'SHA-256' },
        true,
        [ 'sign', 'verify' ]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const wrapped = await crypto.subtle.wrapKey('jwk', hmacKey, wrappingKey, { name: 'AES-GCM', iv });

    assert.ok(wrapped instanceof ArrayBuffer, 'JWK wrapped is ArrayBuffer');

    const unwrapped = await crypto.subtle.unwrapKey(
        'jwk', wrapped, wrappingKey,
        { name: 'AES-GCM', iv },
        { name: 'HMAC', hash: 'SHA-256' },
        true,
        [ 'sign', 'verify' ]
    );

    assert.eq(unwrapped.algorithm.name, 'HMAC', 'JWK unwrapped algorithm');

    // Verify the unwrapped key works
    const data = new TextEncoder().encode('jwk test');
    const sig = await crypto.subtle.sign('HMAC', unwrapped, data);
    const valid = await crypto.subtle.verify('HMAC', unwrapped, sig, data);

    assert.ok(valid, 'JWK unwrapped HMAC key works');
}

// 5. RSA-OAEP wrap/unwrap with JWK format
{
    const rsaKeyPair = await crypto.subtle.generateKey(
        {
            name: 'RSA-OAEP',
            modulusLength: 4096,
            publicExponent: new Uint8Array([ 1, 0, 1 ]),
            hash: 'SHA-256',
        },
        true,
        [ 'wrapKey', 'unwrapKey' ]
    );

    const aesKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 128 },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    const wrapped = await crypto.subtle.wrapKey('jwk', aesKey, rsaKeyPair.publicKey, { name: 'RSA-OAEP' });

    assert.ok(wrapped instanceof ArrayBuffer, 'RSA JWK wrapped is ArrayBuffer');

    const unwrapped = await crypto.subtle.unwrapKey(
        'jwk', wrapped, rsaKeyPair.privateKey,
        { name: 'RSA-OAEP' },
        { name: 'AES-GCM', length: 128 },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    assert.eq(unwrapped.algorithm.name, 'AES-GCM', 'RSA JWK unwrapped algorithm');
    assert.eq(unwrapped.algorithm.length, 128, 'RSA JWK unwrapped key length');
}

// 6. Error: wrapping key without 'wrapKey' usage
{
    const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    const hmacKey = await crypto.subtle.generateKey(
        { name: 'HMAC', hash: 'SHA-256' },
        true,
        [ 'sign' ]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));

    try {
        await crypto.subtle.wrapKey('raw', hmacKey, key, { name: 'AES-GCM', iv });
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.ok(e instanceof DOMException, 'error is DOMException');
        assert.eq(e.name, 'InvalidAccessError', 'missing wrapKey usage gives InvalidAccessError');
    }
}

// 7. Error: unwrapping key without 'unwrapKey' usage
{
    const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));

    try {
        await crypto.subtle.unwrapKey(
            'raw', new ArrayBuffer(32), key,
            { name: 'AES-GCM', iv },
            { name: 'AES-GCM', length: 256 },
            true,
            [ 'encrypt' ]
        );
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.ok(e instanceof DOMException, 'error is DOMException');
        assert.eq(e.name, 'InvalidAccessError', 'missing unwrapKey usage gives InvalidAccessError');
    }
}

// 8. Error: wrap non-extractable key
{
    const wrappingKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        [ 'wrapKey', 'unwrapKey' ]
    );

    const nonExtractable = await crypto.subtle.generateKey(
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        [ 'sign' ]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));

    try {
        await crypto.subtle.wrapKey('raw', nonExtractable, wrappingKey, { name: 'AES-GCM', iv });
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.ok(e instanceof DOMException, 'error is DOMException');
        assert.eq(e.name, 'InvalidAccessError', 'non-extractable key gives InvalidAccessError');
    }
}
