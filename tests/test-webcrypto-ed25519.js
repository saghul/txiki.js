import assert from 'tjs:assert';

// 1. generateKey + sign + verify round-trip
{
    const keyPair = await crypto.subtle.generateKey(
        'Ed25519',
        true,
        [ 'sign', 'verify' ]
    );

    assert.ok(keyPair.publicKey, 'has publicKey');
    assert.ok(keyPair.privateKey, 'has privateKey');
    assert.eq(keyPair.publicKey.type, 'public', 'publicKey type');
    assert.eq(keyPair.privateKey.type, 'private', 'privateKey type');
    assert.eq(keyPair.publicKey.algorithm.name, 'Ed25519', 'publicKey algorithm');
    assert.eq(keyPair.privateKey.algorithm.name, 'Ed25519', 'privateKey algorithm');
    assert.eq(keyPair.publicKey.extractable, true, 'publicKey is extractable');

    const data = new TextEncoder().encode('hello Ed25519');
    const signature = await crypto.subtle.sign(
        'Ed25519',
        keyPair.privateKey,
        data
    );

    assert.ok(signature instanceof ArrayBuffer, 'signature is ArrayBuffer');
    assert.eq(signature.byteLength, 64, 'Ed25519 signature is 64 bytes');

    const valid = await crypto.subtle.verify(
        'Ed25519',
        keyPair.publicKey,
        signature,
        data
    );

    assert.eq(valid, true, 'signature verifies');
}

// 2. Deterministic signatures (sign same message twice → same output)
{
    const keyPair = await crypto.subtle.generateKey('Ed25519', true, [ 'sign', 'verify' ]);
    const data = new TextEncoder().encode('deterministic test');

    const sig1 = await crypto.subtle.sign('Ed25519', keyPair.privateKey, data);
    const sig2 = await crypto.subtle.sign('Ed25519', keyPair.privateKey, data);

    const a = new Uint8Array(sig1);
    const b = new Uint8Array(sig2);

    assert.eq(a.length, b.length, 'same length');

    for (let i = 0; i < a.length; i++) {
        assert.eq(a[i], b[i], `byte ${i} matches`);
    }
}

// 3. Verify with wrong public key → false
{
    const keyPair1 = await crypto.subtle.generateKey('Ed25519', true, [ 'sign', 'verify' ]);
    const keyPair2 = await crypto.subtle.generateKey('Ed25519', true, [ 'sign', 'verify' ]);

    const data = new TextEncoder().encode('wrong key test');
    const signature = await crypto.subtle.sign('Ed25519', keyPair1.privateKey, data);

    const valid = await crypto.subtle.verify('Ed25519', keyPair2.publicKey, signature, data);

    assert.eq(valid, false, 'wrong public key rejects');
}

// 4. Tampered signature → false
{
    const keyPair = await crypto.subtle.generateKey('Ed25519', true, [ 'sign', 'verify' ]);
    const data = new TextEncoder().encode('tamper test');
    const signature = await crypto.subtle.sign('Ed25519', keyPair.privateKey, data);

    const tampered = new Uint8Array(signature);

    tampered[0] ^= 0xff;

    const valid = await crypto.subtle.verify('Ed25519', keyPair.publicKey, tampered, data);

    assert.eq(valid, false, 'tampered signature rejects');
}

// 5. Import/export raw (public key, 32 bytes)
{
    const keyPair = await crypto.subtle.generateKey('Ed25519', true, [ 'sign', 'verify' ]);
    const rawExported = await crypto.subtle.exportKey('raw', keyPair.publicKey);

    assert.ok(rawExported instanceof ArrayBuffer, 'raw export is ArrayBuffer');
    assert.eq(rawExported.byteLength, 32, 'raw public key is 32 bytes');

    const imported = await crypto.subtle.importKey('raw', rawExported, 'Ed25519', true, [ 'verify' ]);

    assert.eq(imported.type, 'public', 'imported key is public');
    assert.eq(imported.algorithm.name, 'Ed25519', 'imported algorithm');

    const data = new TextEncoder().encode('raw import test');
    const signature = await crypto.subtle.sign('Ed25519', keyPair.privateKey, data);
    const valid = await crypto.subtle.verify('Ed25519', imported, signature, data);

    assert.eq(valid, true, 'imported raw key verifies');
}

// 6. Import/export JWK (private and public)
{
    const keyPair = await crypto.subtle.generateKey('Ed25519', true, [ 'sign', 'verify' ]);

    // Public JWK
    const pubJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

    assert.eq(pubJwk.kty, 'OKP', 'public JWK kty');
    assert.eq(pubJwk.crv, 'Ed25519', 'public JWK crv');
    assert.ok(pubJwk.x, 'public JWK has x');
    assert.eq(pubJwk.d, undefined, 'public JWK has no d');
    assert.eq(pubJwk.ext, true, 'public JWK ext');

    const importedPub = await crypto.subtle.importKey('jwk', pubJwk, 'Ed25519', true, [ 'verify' ]);

    assert.eq(importedPub.type, 'public', 'imported public key type');

    // Private JWK
    const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    assert.eq(privJwk.kty, 'OKP', 'private JWK kty');
    assert.eq(privJwk.crv, 'Ed25519', 'private JWK crv');
    assert.ok(privJwk.x, 'private JWK has x');
    assert.ok(privJwk.d, 'private JWK has d');

    const importedPriv = await crypto.subtle.importKey('jwk', privJwk, 'Ed25519', true, [ 'sign' ]);

    assert.eq(importedPriv.type, 'private', 'imported private key type');

    // Verify imported keys work together
    const data = new TextEncoder().encode('JWK round-trip');
    const signature = await crypto.subtle.sign('Ed25519', importedPriv, data);
    const valid = await crypto.subtle.verify('Ed25519', importedPub, signature, data);

    assert.eq(valid, true, 'JWK imported keys work');
}

// 7. Import/export SPKI
{
    const keyPair = await crypto.subtle.generateKey('Ed25519', true, [ 'sign', 'verify' ]);
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);

    assert.ok(spki instanceof ArrayBuffer, 'spki export is ArrayBuffer');
    assert.eq(spki.byteLength, 44, 'SPKI is 44 bytes');

    const imported = await crypto.subtle.importKey('spki', spki, 'Ed25519', true, [ 'verify' ]);

    assert.eq(imported.type, 'public', 'imported key is public');

    const data = new TextEncoder().encode('spki test');
    const signature = await crypto.subtle.sign('Ed25519', keyPair.privateKey, data);
    const valid = await crypto.subtle.verify('Ed25519', imported, signature, data);

    assert.eq(valid, true, 'SPKI imported key verifies');
}

// 8. Import/export PKCS8
{
    const keyPair = await crypto.subtle.generateKey('Ed25519', true, [ 'sign', 'verify' ]);
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    assert.ok(pkcs8 instanceof ArrayBuffer, 'pkcs8 export is ArrayBuffer');
    assert.eq(pkcs8.byteLength, 48, 'PKCS8 is 48 bytes');

    const imported = await crypto.subtle.importKey('pkcs8', pkcs8, 'Ed25519', true, [ 'sign' ]);

    assert.eq(imported.type, 'private', 'imported key is private');

    const data = new TextEncoder().encode('pkcs8 test');
    const signature = await crypto.subtle.sign('Ed25519', imported, data);
    const valid = await crypto.subtle.verify('Ed25519', keyPair.publicKey, signature, data);

    assert.eq(valid, true, 'PKCS8 imported key signs correctly');
}

// 9. RFC 8032 §7.1 test vector 1 (empty message)
{
    // Test vector 1 from RFC 8032 §7.1
    const privKeyHex = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';
    const pubKeyHex = 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a';
    const expectedSigHex =
        'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e06522490155' +
        '5fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b';

    function hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);

        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }

        return bytes;
    }

    const privKey = await crypto.subtle.importKey(
        'pkcs8',
        new Uint8Array([
            0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
            0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
            ...hexToBytes(privKeyHex),
        ]),
        'Ed25519',
        true,
        [ 'sign' ]
    );

    const pubKey = await crypto.subtle.importKey(
        'raw',
        hexToBytes(pubKeyHex),
        'Ed25519',
        true,
        [ 'verify' ]
    );

    // Sign empty message
    const signature = await crypto.subtle.sign('Ed25519', privKey, new Uint8Array(0));
    const sigBytes = new Uint8Array(signature);
    const expectedSig = hexToBytes(expectedSigHex);

    assert.eq(sigBytes.length, expectedSig.length, 'signature length matches');

    for (let i = 0; i < sigBytes.length; i++) {
        assert.eq(sigBytes[i], expectedSig[i], `sig byte ${i} matches`);
    }

    // Verify
    const valid = await crypto.subtle.verify('Ed25519', pubKey, signature, new Uint8Array(0));

    assert.eq(valid, true, 'RFC 8032 test vector verifies');
}

// 10. Error: sign with public key → InvalidAccessError
{
    const keyPair = await crypto.subtle.generateKey('Ed25519', true, [ 'sign', 'verify' ]);

    try {
        await crypto.subtle.sign('Ed25519', keyPair.publicKey, new Uint8Array([ 1, 2, 3 ]));
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'InvalidAccessError', 'sign with public key throws InvalidAccessError');
    }
}

// 11. Error: verify with private key → InvalidAccessError
{
    const keyPair = await crypto.subtle.generateKey('Ed25519', true, [ 'sign', 'verify' ]);

    try {
        await crypto.subtle.verify('Ed25519', keyPair.privateKey, new Uint8Array(64), new Uint8Array([ 1, 2, 3 ]));
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'InvalidAccessError', 'verify with private key throws InvalidAccessError');
    }
}

// 12. Error: invalid usages → SyntaxError
{
    try {
        await crypto.subtle.generateKey('Ed25519', true, [ 'encrypt' ]);
        assert.ok(false, 'should have thrown');
    } catch (e) {
        assert.eq(e.name, 'SyntaxError', 'invalid usage throws SyntaxError');
    }
}
