import assert from 'tjs:assert';

// generateKey + sign + verify round-trip
{
    const key = await crypto.subtle.generateKey(
        { name: 'HMAC', hash: 'SHA-256' },
        true,
        [ 'sign', 'verify' ]
    );

    assert.eq(key.type, 'secret', 'key type is secret');
    assert.eq(key.algorithm.name, 'HMAC', 'algorithm name is HMAC');
    assert.eq(key.algorithm.hash.name, 'SHA-256', 'hash is SHA-256');
    assert.eq(key.extractable, true, 'key is extractable');
    assert.ok(key.usages.includes('sign'), 'key has sign usage');
    assert.ok(key.usages.includes('verify'), 'key has verify usage');

    const data = new TextEncoder().encode('hello world');
    const signature = await crypto.subtle.sign('HMAC', key, data);

    assert.ok(signature instanceof ArrayBuffer, 'signature is ArrayBuffer');
    assert.eq(signature.byteLength, 32, 'SHA-256 signature is 32 bytes');

    const valid = await crypto.subtle.verify('HMAC', key, signature, data);
    assert.eq(valid, true, 'signature verifies');

    const tampered = new Uint8Array(signature);
    tampered[0] ^= 0xff;
    const invalid = await crypto.subtle.verify('HMAC', key, tampered, data);
    assert.eq(invalid, false, 'tampered signature fails');
}

// importKey / exportKey round-trip
{
    const rawKey = new Uint8Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ]);
    const key = await crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'HMAC', hash: 'SHA-256' },
        true,
        [ 'sign', 'verify' ]
    );

    assert.eq(key.type, 'secret');
    assert.eq(key.extractable, true);

    const exported = await crypto.subtle.exportKey('raw', key);
    assert.ok(exported instanceof ArrayBuffer, 'exported is ArrayBuffer');

    const exportedBytes = new Uint8Array(exported);
    assert.eq(exportedBytes.length, rawKey.length, 'exported key same length');

    for (let i = 0; i < rawKey.length; i++) {
        assert.eq(exportedBytes[i], rawKey[i], `byte ${i} matches`);
    }
}

// RFC 4231 Test Case 2: HMAC-SHA-256 with key "Jefe"
{
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode('Jefe'),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        [ 'sign' ]
    );

    const data = new TextEncoder().encode('what do ya want for nothing?');
    const signature = await crypto.subtle.sign('HMAC', key, data);
    const hex = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    assert.eq(
        hex,
        '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
        'RFC 4231 test vector matches'
    );
}

// All hash algorithms
for (const hash of [ 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512' ]) {
    const expectedSizes = { 'SHA-1': 20, 'SHA-256': 32, 'SHA-384': 48, 'SHA-512': 64 };
    const key = await crypto.subtle.generateKey(
        { name: 'HMAC', hash },
        true,
        [ 'sign', 'verify' ]
    );

    const data = new TextEncoder().encode('test data');
    const sig = await crypto.subtle.sign('HMAC', key, data);

    assert.eq(sig.byteLength, expectedSizes[hash], `${hash} produces ${expectedSizes[hash]} byte signature`);

    const valid = await crypto.subtle.verify('HMAC', key, sig, data);
    assert.eq(valid, true, `${hash} signature verifies`);
}

// Non-extractable key export rejection
// NOTE: rejection tests are at the end to avoid a pre-existing runtime bug
// where Promise.reject + native async callback causes a GC leak.
{
    const key = await crypto.subtle.importKey(
        'raw',
        new Uint8Array([ 1, 2, 3, 4 ]),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        [ 'sign' ]
    );

    assert.eq(key.extractable, false);

    try {
        await crypto.subtle.exportKey('raw', key);
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.ok(e instanceof DOMException, 'error is DOMException');
        assert.eq(e.name, 'InvalidAccessError', 'error name is InvalidAccessError');
    }
}

// Wrong usage rejection
{
    const key = await crypto.subtle.importKey(
        'raw',
        new Uint8Array([ 1, 2, 3, 4 ]),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        [ 'verify' ]  // only verify, not sign
    );

    try {
        await crypto.subtle.sign('HMAC', key, new Uint8Array([ 1 ]));
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.ok(e instanceof DOMException, 'error is DOMException');
        assert.eq(e.name, 'InvalidAccessError', 'error name is InvalidAccessError');
    }
}
