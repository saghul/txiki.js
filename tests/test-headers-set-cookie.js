import assert from 'tjs:assert';

// Set-Cookie values must never be combined (RFC 6265 § 3), so Headers keeps
// them as a list: getSetCookie() exposes it, iteration yields one entry per
// cookie, and get() joins them as the Fetch spec says.

const h = new Headers();

assert.eq(h.getSetCookie(), [], 'getSetCookie() is [] when absent');
assert.eq(h.get('set-cookie'), null, 'get() is null when absent');

h.append('Set-Cookie', 'a=1; Path=/');
h.append('X-Multi', 'x');
h.append('set-cookie', 'b=2; Path=/');
h.append('X-Multi', 'y');

assert.eq(h.getSetCookie(), [ 'a=1; Path=/', 'b=2; Path=/' ], 'append() keeps cookies separate');
assert.eq(h.get('Set-Cookie'), 'a=1; Path=/, b=2; Path=/', 'get() joins cookies with ", "');
assert.eq(h.get('x-multi'), 'x, y', 'other repeated headers still combine');
assert.ok(h.has('SET-COOKIE'), 'has() finds set-cookie');

h.getSetCookie().push('c=3');
assert.eq(h.getSetCookie().length, 2, 'getSetCookie() returns a copy');

const expected = [
    [ 'set-cookie', 'a=1; Path=/' ],
    [ 'set-cookie', 'b=2; Path=/' ],
    [ 'x-multi', 'x, y' ],
];
const seen = [];

h.forEach((value, name) => seen.push([ name, value ]));
assert.eq(seen, expected, 'forEach() yields one entry per cookie');
assert.eq([ ...h ], expected, 'iterator yields one entry per cookie');
assert.eq([ ...h.entries() ], expected, 'entries() yields one entry per cookie');
assert.eq([ ...h.keys() ], [ 'set-cookie', 'set-cookie', 'x-multi' ], 'keys() repeats set-cookie');
assert.eq([ ...h.values() ], [ 'a=1; Path=/', 'b=2; Path=/', 'x, y' ], 'values() lists each cookie');

assert.eq(new Headers(h).getSetCookie(), [ 'a=1; Path=/', 'b=2; Path=/' ], 'copy constructor keeps cookies');
assert.eq(new Headers([ ...h ]).getSetCookie(), [ 'a=1; Path=/', 'b=2; Path=/' ], 'pair list keeps cookies');

const res = new Response('ok', { headers: h });

assert.eq(res.headers.getSetCookie().length, 2, 'Response keeps cookies');
assert.eq(res.clone().headers.getSetCookie().length, 2, 'Response.clone() keeps cookies');

const req = new Request('http://example.com/', { headers: h });

assert.eq(new Request(req).headers.getSetCookie().length, 2, 'new Request(req) keeps cookies');

h.set('Set-Cookie', 'c=3');
assert.eq(h.getSetCookie(), [ 'c=3' ], 'set() replaces the list');
assert.eq(h.get('set-cookie'), 'c=3', 'get() after set()');

h.delete('set-cookie');
assert.eq(h.getSetCookie(), [], 'delete() removes the list');
assert.ok(!h.has('set-cookie'), 'has() is false after delete()');
assert.eq([ ...h ], [ [ 'x-multi', 'x, y' ] ], 'only the other header remains');
