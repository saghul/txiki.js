// A header value with CR, LF or NUL inside it would put extra header lines on
// the wire, so it must be rejected before any request is made. Surrounding
// whitespace is trimmed instead.
import assert from 'tjs:assert';

const bad = [ 'v\r\nInjected: yes', 'v\nInjected: yes', 'v\rx', 'v\0x' ];

for (const value of bad) {
    const label = JSON.stringify(value);

    assert.throws(() => new Headers({ 'x-a': value }), TypeError, `Headers init ${label}`);
    assert.throws(() => new Headers([ [ 'x-a', value ] ]), TypeError, `Headers pairs ${label}`);
    assert.throws(() => new Headers().append('x-a', value), TypeError, `append ${label}`);
    assert.throws(() => new Headers().set('x-a', value), TypeError, `set ${label}`);

    let error;

    try {
        await fetch('http://127.0.0.1:1/', { headers: { 'x-a': value } });
    } catch (e) {
        error = e;
    }

    assert.ok(error instanceof TypeError, `fetch rejects ${label}`);
}

const h = new Headers({ 'x-a': ' \t v \r\n' });

assert.eq(h.get('x-a'), 'v', 'surrounding whitespace trimmed');
