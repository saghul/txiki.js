// A DataView body is a copy of exactly the bytes it views, not its whole
// underlying buffer.
import assert from 'tjs:assert';

const bytesOf = async r => Array.from(new Uint8Array(await r.arrayBuffer()));

const makeBodies = body => [
    [ 'Response', new Response(body) ],
    [ 'Request', new Request('http://example.com/', { method: 'POST', body }) ],
];

{
    const u8 = new Uint8Array([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
    const bodies = makeBodies(new DataView(u8.buffer, 2, 3));

    u8.fill(0);

    for (const [ label, r ] of bodies) {
        assert.eq(await bytesOf(r), [ 3, 4, 5 ], `${label}(DataView(ab, 2, 3))`);
    }
}

{
    const u8 = new Uint8Array([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
    const bodies = makeBodies(new DataView(u8.buffer));

    u8.fill(0);

    for (const [ label, r ] of bodies) {
        assert.eq(await bytesOf(r), [ 1, 2, 3, 4, 5, 6, 7, 8 ], `${label}(DataView(ab))`);
    }
}
