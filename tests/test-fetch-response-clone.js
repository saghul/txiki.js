import assert from 'tjs:assert';

// Response.clone() must give the original and the clone independently readable
// copies of the body (the two must not share a single stream).
{
    const resp = new Response('hello world', {
        status: 201,
        statusText: 'Created',
        headers: { 'x-test': 'orig' },
    });
    const clone = resp.clone();

    assert.eq(clone.status, 201, 'clone preserves status');
    assert.eq(clone.statusText, 'Created', 'clone preserves statusText');
    assert.eq(clone.headers.get('x-test'), 'orig', 'clone copies custom header');
    assert.ok(!resp.bodyUsed, 'original not consumed by clone');
    assert.ok(!clone.bodyUsed, 'clone not consumed by clone');

    assert.eq(await clone.text(), 'hello world', 'clone body readable');
    assert.eq(await resp.text(), 'hello world', 'original body still readable after clone was read');
}

// Copied headers are independent of the original.
{
    const resp = new Response('x', { headers: { 'x-test': 'orig' } });
    const clone = resp.clone();

    clone.headers.set('x-test', 'changed');
    assert.eq(resp.headers.get('x-test'), 'orig', 'original headers unaffected by clone mutation');
}

// A no-body response clones cleanly.
{
    const resp = new Response(null, { status: 204 });
    const clone = resp.clone();

    assert.eq(clone.status, 204, 'no-body clone preserves status');
    assert.eq(clone.body, null, 'no-body clone has null body');
    assert.eq(await clone.text(), '', 'no-body clone reads empty');
}

// Cloning a response whose body has already been read throws (WHATWG clone()).
{
    const resp = new Response('data');

    await resp.text();
    assert.throws(() => resp.clone(), TypeError, 'clone after read throws TypeError');
}

// A streaming-body response (as produced by fetch) clones into independent
// readers that each yield the full body.
{
    const resp = new Response(new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode('streamed'));
            controller.close();
        },
    }));
    const clone = resp.clone();

    assert.eq(await clone.text(), 'streamed', 'clone of streaming body readable');
    assert.eq(await resp.text(), 'streamed', 'original streaming body still readable');
}
