import assert from 'tjs:assert';

// 1. HMAC JWK round-trip (SHA-256)
{
    const key = await crypto.subtle.generateKey(
        { name: 'HMAC', hash: 'SHA-256' },
        true,
        [ 'sign', 'verify' ]
    );

    const jwk = await crypto.subtle.exportKey('jwk', key);

    assert.eq(jwk.kty, 'oct', 'HMAC JWK kty is oct');
    assert.eq(jwk.alg, 'HS256', 'HMAC JWK alg is HS256');
    assert.eq(jwk.ext, true, 'HMAC JWK ext is true');
    assert.ok(jwk.k, 'HMAC JWK has k field');

    const imported = await crypto.subtle.importKey(
        'jwk', jwk,
        { name: 'HMAC', hash: 'SHA-256' },
        true,
        [ 'sign', 'verify' ]
    );

    const data = new TextEncoder().encode('hello world');
    const sig1 = await crypto.subtle.sign('HMAC', key, data);
    const sig2 = await crypto.subtle.sign('HMAC', imported, data);

    const a = new Uint8Array(sig1);
    const b = new Uint8Array(sig2);

    assert.eq(a.length, b.length, 'HMAC signatures same length');

    for (let i = 0; i < a.length; i++) {
        assert.eq(a[i], b[i], `HMAC sig byte ${i} matches`);
    }
}

// 2. HMAC JWK with all hash algorithms
for (const hash of [ 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512' ]) {
    const algMap = { 'SHA-1': 'HS1', 'SHA-256': 'HS256', 'SHA-384': 'HS384', 'SHA-512': 'HS512' };
    const key = await crypto.subtle.generateKey(
        { name: 'HMAC', hash },
        true,
        [ 'sign', 'verify' ]
    );

    const jwk = await crypto.subtle.exportKey('jwk', key);

    assert.eq(jwk.alg, algMap[hash], `HMAC ${hash} JWK alg is ${algMap[hash]}`);

    const imported = await crypto.subtle.importKey(
        'jwk', jwk,
        { name: 'HMAC', hash },
        true,
        [ 'verify' ]
    );

    const data = new TextEncoder().encode('test');
    const sig = await crypto.subtle.sign('HMAC', key, data);
    const valid = await crypto.subtle.verify('HMAC', imported, sig, data);

    assert.eq(valid, true, `HMAC ${hash} JWK verify works`);
}

// 3. AES-GCM JWK round-trip (256-bit)
{
    const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    const jwk = await crypto.subtle.exportKey('jwk', key);

    assert.eq(jwk.kty, 'oct', 'AES JWK kty is oct');
    assert.eq(jwk.alg, 'A256GCM', 'AES-GCM 256 JWK alg');
    assert.eq(jwk.ext, true, 'AES JWK ext is true');

    const imported = await crypto.subtle.importKey(
        'jwk', jwk,
        { name: 'AES-GCM' },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode('secret message');
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, imported, encrypted);
    const result = new TextDecoder().decode(decrypted);

    assert.eq(result, 'secret message', 'AES-GCM JWK decrypt works');
}

// 4. AES-CBC JWK round-trip all lengths
for (const length of [ 128, 192, 256 ]) {
    const key = await crypto.subtle.generateKey(
        { name: 'AES-CBC', length },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    const jwk = await crypto.subtle.exportKey('jwk', key);

    assert.eq(jwk.alg, `A${length}CBC`, `AES-CBC ${length} JWK alg`);

    const imported = await crypto.subtle.importKey(
        'jwk', jwk,
        { name: 'AES-CBC' },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    const iv = crypto.getRandomValues(new Uint8Array(16));
    const data = new TextEncoder().encode('test data');
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, data);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, imported, encrypted);
    const result = new TextDecoder().decode(decrypted);

    assert.eq(result, 'test data', `AES-CBC ${length} JWK round-trip`);
}

// 5. ECDSA JWK round-trip all curves
for (const namedCurve of [ 'P-256', 'P-384', 'P-521' ]) {
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve },
        true,
        [ 'sign', 'verify' ]
    );

    const pubJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

    assert.eq(pubJwk.kty, 'EC', `ECDSA ${namedCurve} pub kty`);
    assert.eq(pubJwk.crv, namedCurve, `ECDSA ${namedCurve} pub crv`);
    assert.ok(pubJwk.x, `ECDSA ${namedCurve} pub has x`);
    assert.ok(pubJwk.y, `ECDSA ${namedCurve} pub has y`);
    assert.ok(!pubJwk.d, `ECDSA ${namedCurve} pub has no d`);

    const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    assert.ok(privJwk.d, `ECDSA ${namedCurve} priv has d`);
    assert.ok(privJwk.x, `ECDSA ${namedCurve} priv has x`);
    assert.ok(privJwk.y, `ECDSA ${namedCurve} priv has y`);

    const importedPriv = await crypto.subtle.importKey(
        'jwk', privJwk,
        { name: 'ECDSA', namedCurve },
        true,
        [ 'sign' ]
    );

    const importedPub = await crypto.subtle.importKey(
        'jwk', pubJwk,
        { name: 'ECDSA', namedCurve },
        true,
        [ 'verify' ]
    );

    const data = new TextEncoder().encode('test');
    const hashMap = { 'P-256': 'SHA-256', 'P-384': 'SHA-384', 'P-521': 'SHA-512' };
    const sig = await crypto.subtle.sign(
        { name: 'ECDSA', hash: hashMap[namedCurve] },
        importedPriv, data
    );
    const valid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: hashMap[namedCurve] },
        importedPub, sig, data
    );

    assert.eq(valid, true, `ECDSA ${namedCurve} JWK sign/verify`);
}

// 6. ECDH JWK round-trip
{
    const keyPair1 = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        [ 'deriveBits' ]
    );
    const keyPair2 = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        [ 'deriveBits' ]
    );

    const privJwk = await crypto.subtle.exportKey('jwk', keyPair1.privateKey);
    const pubJwk = await crypto.subtle.exportKey('jwk', keyPair2.publicKey);

    const importedPriv = await crypto.subtle.importKey(
        'jwk', privJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        [ 'deriveBits' ]
    );
    const importedPub = await crypto.subtle.importKey(
        'jwk', pubJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        []
    );

    const bits1 = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: keyPair2.publicKey },
        keyPair1.privateKey, 256
    );
    const bits2 = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: importedPub },
        importedPriv, 256
    );

    const a = new Uint8Array(bits1);
    const b = new Uint8Array(bits2);

    assert.eq(a.length, b.length, 'ECDH derived bits same length');

    for (let i = 0; i < a.length; i++) {
        assert.eq(a[i], b[i], `ECDH derived byte ${i} matches`);
    }
}

// 7. RSA-OAEP JWK round-trip
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        true,
        [ 'encrypt', 'decrypt' ]
    );

    const pubJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

    assert.eq(pubJwk.kty, 'RSA', 'RSA-OAEP pub kty');
    assert.eq(pubJwk.alg, 'RSA-OAEP-256', 'RSA-OAEP-256 alg');
    assert.ok(pubJwk.n, 'RSA pub has n');
    assert.ok(pubJwk.e, 'RSA pub has e');
    assert.ok(!pubJwk.d, 'RSA pub has no d');

    const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    assert.ok(privJwk.d, 'RSA priv has d');
    assert.ok(privJwk.p, 'RSA priv has p');
    assert.ok(privJwk.q, 'RSA priv has q');
    assert.ok(privJwk.dp, 'RSA priv has dp');
    assert.ok(privJwk.dq, 'RSA priv has dq');
    assert.ok(privJwk.qi, 'RSA priv has qi');

    const importedPub = await crypto.subtle.importKey(
        'jwk', pubJwk,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        [ 'encrypt' ]
    );
    const importedPriv = await crypto.subtle.importKey(
        'jwk', privJwk,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        [ 'decrypt' ]
    );

    const data = new TextEncoder().encode('hello RSA');
    const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, importedPub, data);
    const decrypted = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, importedPriv, encrypted);
    const result = new TextDecoder().decode(decrypted);

    assert.eq(result, 'hello RSA', 'RSA-OAEP JWK encrypt/decrypt');
}

// 8. RSA-PSS JWK round-trip
{
    const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-PSS', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' },
        true,
        [ 'sign', 'verify' ]
    );

    const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const pubJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

    assert.eq(privJwk.alg, 'PS256', 'RSA-PSS alg is PS256');
    assert.eq(pubJwk.alg, 'PS256', 'RSA-PSS pub alg is PS256');

    const importedPriv = await crypto.subtle.importKey(
        'jwk', privJwk,
        { name: 'RSA-PSS', hash: 'SHA-256' },
        true,
        [ 'sign' ]
    );
    const importedPub = await crypto.subtle.importKey(
        'jwk', pubJwk,
        { name: 'RSA-PSS', hash: 'SHA-256' },
        true,
        [ 'verify' ]
    );

    const data = new TextEncoder().encode('test PSS');
    const sig = await crypto.subtle.sign(
        { name: 'RSA-PSS', saltLength: 32 },
        importedPriv, data
    );
    const valid = await crypto.subtle.verify(
        { name: 'RSA-PSS', saltLength: 32 },
        importedPub, sig, data
    );

    assert.eq(valid, true, 'RSA-PSS JWK sign/verify');
}

// 9. RSASSA-PKCS1-v1_5 JWK round-trip
{
    const keyPair = await crypto.subtle.generateKey(
        {
            name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
            publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256',
        },
        true,
        [ 'sign', 'verify' ]
    );

    const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const pubJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

    assert.eq(privJwk.alg, 'RS256', 'RSASSA-PKCS1-v1_5 alg is RS256');

    const importedPriv = await crypto.subtle.importKey(
        'jwk', privJwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        true,
        [ 'sign' ]
    );
    const importedPub = await crypto.subtle.importKey(
        'jwk', pubJwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        true,
        [ 'verify' ]
    );

    const data = new TextEncoder().encode('test PKCS1');
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', importedPriv, data);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', importedPub, sig, data);

    assert.eq(valid, true, 'RSASSA-PKCS1-v1_5 JWK sign/verify');
}

// Error tests at the end to avoid GC issues with Promise.reject

// 10. Import JWK with wrong kty
{
    try {
        await crypto.subtle.importKey(
            'jwk',
            { kty: 'wrong', k: 'AAAA' },
            { name: 'HMAC', hash: 'SHA-256' },
            true,
            [ 'sign' ]
        );
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.ok(e instanceof DOMException, 'wrong kty is DOMException');
        assert.eq(e.name, 'DataError', 'wrong kty error name');
    }
}

// 11. Non-extractable key JWK export
{
    const key = await crypto.subtle.generateKey(
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        [ 'sign' ]
    );

    try {
        await crypto.subtle.exportKey('jwk', key);
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.ok(e instanceof DOMException, 'non-extractable is DOMException');
        assert.eq(e.name, 'InvalidAccessError', 'non-extractable error name');
    }
}
