// importKey must accept key bytes whose buffer is pinned by an in-flight native
// write, and import exactly the viewed bytes.
import assert from 'tjs:assert';
import path from 'tjs:path';

const subtle = crypto.subtle;
const msg = new TextEncoder().encode('pinned key material');

function u8(ab) {
    return new Uint8Array(ab);
}

const ed = await subtle.generateKey({ name: 'Ed25519' }, true, [ 'sign', 'verify' ]);
const x = await subtle.generateKey({ name: 'X25519' }, true, [ 'deriveBits' ]);
const xPeer = await subtle.generateKey({ name: 'X25519' }, true, [ 'deriveBits' ]);
const ec = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [ 'sign', 'verify' ]);
const rsaAlg = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' };
const rsa = await subtle.generateKey(rsaAlg, true, [ 'sign', 'verify' ]);

const data = new Uint8Array(16 * 1024 * 1024);

for (let i = 0; i < data.length; i++) {
    data[i] = (i * 7) & 0xff;
}

const placed = {};
let off = 1001;

for (const [ name, bytes ] of [
    [ 'secret', data.slice(0, 32) ],
    [ 'ed', u8(await subtle.exportKey('raw', ed.publicKey)) ],
    [ 'x', u8(await subtle.exportKey('raw', x.publicKey)) ],
    [ 'ec', u8(await subtle.exportKey('raw', ec.publicKey)) ],
    [ 'rsa', u8(await subtle.exportKey('spki', rsa.publicKey)) ],
]) {
    data.set(bytes, off);
    placed[name] = { off, len: bytes.byteLength };
    off += bytes.byteLength + 13;
}

const copy = data.slice();
const sub = (a, name) => a.subarray(placed[name].off, placed[name].off + placed[name].len);

const hmacAlg = { name: 'HMAC', hash: 'SHA-256' };
const pbkdf2Params = { name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(16), iterations: 1000 };
const gcmParams = { name: 'AES-GCM', iv: new Uint8Array(12) };

function importAll(src, whole) {
    return Promise.all([
        subtle.importKey('raw', sub(src, 'secret'), hmacAlg, false, [ 'sign' ]),
        subtle.importKey('raw', whole, hmacAlg, false, [ 'sign' ]),
        subtle.importKey('raw', sub(src, 'secret'), { name: 'AES-GCM' }, false, [ 'encrypt' ]),
        subtle.importKey('raw', sub(src, 'secret'), 'PBKDF2', false, [ 'deriveBits' ]),
        subtle.importKey('raw', whole, 'PBKDF2', false, [ 'deriveBits' ]),
        subtle.importKey('raw', sub(src, 'ed'), { name: 'Ed25519' }, true, [ 'verify' ]),
        subtle.importKey('raw', sub(src, 'x'), { name: 'X25519' }, true, []),
        subtle.importKey('raw', sub(src, 'ec'), { name: 'ECDSA', namedCurve: 'P-256' }, true, [ 'verify' ]),
        subtle.importKey('spki', sub(src, 'rsa'), rsaAlg, true, [ 'verify' ]),
    ]);
}

async function results(keys) {
    const [ hmacSub, hmacWhole, aes, pbkdf2Sub, pbkdf2Whole, edPub, xPub, ecPub, rsaPub ] = keys;
    const edSig = await subtle.sign({ name: 'Ed25519' }, ed.privateKey, msg);
    const ecSig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, ec.privateKey, msg);
    const rsaSig = await subtle.sign(rsaAlg, rsa.privateKey, msg);

    return {
        hmacSub: u8(await subtle.sign(hmacAlg, hmacSub, msg)),
        hmacWhole: u8(await subtle.sign(hmacAlg, hmacWhole, msg)),
        aes: u8(await subtle.encrypt(gcmParams, aes, msg)),
        pbkdf2Sub: u8(await subtle.deriveBits(pbkdf2Params, pbkdf2Sub, 256)),
        pbkdf2Whole: u8(await subtle.deriveBits(pbkdf2Params, pbkdf2Whole, 256)),
        ed: await subtle.verify({ name: 'Ed25519' }, edPub, edSig, msg),
        x: u8(await subtle.deriveBits({ name: 'X25519', public: xPub }, xPeer.privateKey, 256)),
        xRaw: u8(await subtle.exportKey('raw', xPub)),
        ec: await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, ecPub, ecSig, msg),
        ecRaw: u8(await subtle.exportKey('raw', ecPub)),
        rsa: await subtle.verify(rsaAlg, rsaPub, rsaSig, msg),
    };
}

const f = await tjs.makeTempFile(path.join(tjs.tmpDir, 'tjs-buf-pin-XXXXXX'));
const fpath = f.path;

try {
    const w = f.write(data);

    assert.ok(data.buffer.immutable, 'buffer is pinned by the in-flight write');

    const pinnedKeys = importAll(data, data.buffer);

    assert.ok(data.buffer.immutable, 'buffer still pinned after the imports were issued');

    const pinned = await results(await pinnedKeys);

    await w;

    assert.ok(!data.buffer.immutable, 'buffer released after the write');

    const st = await f.stat();

    assert.eq(st.size, data.length);

    const expected = await results(await importAll(copy, copy.buffer));

    assert.eq(pinned.ed, true, 'Ed25519 signature verifies with pinned import');
    assert.eq(pinned.ec, true, 'ECDSA signature verifies with pinned import');
    assert.eq(pinned.rsa, true, 'RSA signature verifies with pinned import');
    assert.eq(pinned.xRaw, sub(copy, 'x'), 'X25519 public key bytes');
    assert.eq(pinned.ecRaw, sub(copy, 'ec'), 'ECDSA public key bytes');
    assert.eq(pinned, expected, 'pinned imports behave like unpinned imports');
} finally {
    await f.close();
    await tjs.remove(fpath);
}
