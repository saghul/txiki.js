// A TypedArray body is a copy of exactly the bytes it views, whatever its
// element type, offset or length.
import assert from 'tjs:assert';

const bytesOf = async r => new Uint8Array(await r.arrayBuffer());

const makeBodies = body => [
    [ 'Response', new Response(body) ],
    [ 'Request', new Request('http://example.com/', { method: 'POST', body }) ],
];

{
    const u16 = new Uint16Array([ 0x1234, 0x5678 ]);
    const expected = new Uint8Array(u16.buffer).slice();
    const bodies = makeBodies(u16);

    u16[0] = 0;
    u16[1] = 0;

    for (const [ label, r ] of bodies) {
        const got = await bytesOf(r);

        assert.eq(got.byteLength, 4, `${label}(Uint16Array) byteLength`);
        assert.eq(Array.from(got), Array.from(expected), `${label}(Uint16Array) bytes`);
    }
}

{
    const sub = new Float64Array([ 1.5, 2.5, 3.5 ]).subarray(1);
    const expected = new Uint8Array(sub.buffer, sub.byteOffset, sub.byteLength).slice();
    const bodies = makeBodies(sub);

    sub.fill(0);

    for (const [ label, r ] of bodies) {
        const got = await bytesOf(r);

        assert.eq(got.byteLength, 16, `${label}(Float64Array subarray) byteLength`);
        assert.eq(Array.from(got), Array.from(expected), `${label}(Float64Array subarray) bytes`);
    }
}
