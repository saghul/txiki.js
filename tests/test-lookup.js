import assert from 'tjs:assert';


const res1 = await tjs.lookup('google.com');
assert.falsy(Array.isArray(res1));
assert.ok(res1.ip, 'there is a result');
assert.ok(res1.family, 'there is a result');

const res2 = await tjs.lookup('google.com', { all: true });
assert.ok(Array.isArray(res2));
for (const r of res2) {
    assert.ok(r.ip, 'there is a result');
    assert.ok(r.family, 'there is a result');
}

const res3 = await tjs.lookup('google.com', { family: 4, all: true });
assert.ok(Array.isArray(res3));
for (const r of res3) {
    assert.ok(r.ip, 'there is a result');
    assert.eq(r.family, 4, 'family is 4');
}

const res4 = await tjs.lookup('google.com', { family: 6, all: true });
assert.ok(Array.isArray(res4));
for (const r of res4) {
    assert.ok(r.ip, 'there is a result');
    assert.eq(r.family, 6, 'family is 6');
}
