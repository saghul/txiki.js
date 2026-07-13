import assert from 'tjs:assert';

// Request.clone() on a body-bearing request must not throw, and the original
// and the clone must each be independently readable with identical contents.
{
    const req = new Request('http://example.com/', { method: 'POST', body: 'hello world' });
    const clone = req.clone();

    assert.eq(clone.method, 'POST', 'clone preserves method');
    assert.eq(clone.url, 'http://example.com/', 'clone preserves url');
    assert.ok(!req.bodyUsed, 'original not consumed by clone');
    assert.ok(!clone.bodyUsed, 'clone not consumed by clone');

    assert.eq(await clone.text(), 'hello world', 'clone body readable');
    assert.eq(await req.text(), 'hello world', 'original body still readable after clone was read');
}

// Headers are copied: mutating the clone's headers must not affect the original.
{
    const req = new Request('http://example.com/', {
        method: 'POST',
        body: 'x',
        headers: { 'x-test': 'orig' },
    });
    const clone = req.clone();

    assert.eq(clone.headers.get('x-test'), 'orig', 'clone copies custom header');
    assert.eq(clone.headers.get('content-type'), 'text/plain;charset=UTF-8', 'clone copies content-type');

    clone.headers.set('x-test', 'changed');
    assert.eq(req.headers.get('x-test'), 'orig', 'original headers unaffected by clone mutation');
}

// A no-body request clones cleanly.
{
    const req = new Request('http://example.com/', { method: 'GET' });
    const clone = req.clone();

    assert.eq(clone.method, 'GET', 'no-body clone preserves method');
    assert.eq(clone.body, null, 'no-body clone has null body');
    assert.eq(await clone.text(), '', 'no-body clone reads empty');
}

// Cloning a request whose body has already been read throws (WHATWG clone()).
{
    const req = new Request('http://example.com/', { method: 'POST', body: 'data' });

    await req.text();
    assert.throws(() => req.clone(), TypeError, 'clone after read throws TypeError');
}

// Binary bodies survive the clone byte-for-byte on both sides.
{
    const bytes = new Uint8Array([ 0, 1, 2, 250, 255 ]);
    const req = new Request('http://example.com/', { method: 'PUT', body: bytes });
    const clone = req.clone();

    const fromClone = new Uint8Array(await clone.arrayBuffer());
    const fromOrig = new Uint8Array(await req.arrayBuffer());

    assert.eq(Array.from(fromClone), Array.from(bytes), 'clone preserves bytes');
    assert.eq(Array.from(fromOrig), Array.from(bytes), 'original preserves bytes');
}

// A clone can itself be cloned.
{
    const req = new Request('http://example.com/', { method: 'POST', body: 'chain' });
    const clone = req.clone();
    const cloneOfClone = clone.clone();

    assert.eq(await cloneOfClone.text(), 'chain', 'clone of clone readable');
    assert.eq(await clone.text(), 'chain', 'intermediate clone still readable');
    assert.eq(await req.text(), 'chain', 'original still readable');
}
