import assert from 'tjs:assert';

const cases = [
    [ Float64Array, [ 3.5, -1.25, 2, 0.5 ] ],
    [ BigInt64Array, [ 3n, -1n, 2n, 0n ] ],
    [ BigUint64Array, [ 3n, 1n, 2n, 0n ] ],
];

for (const [ TypedArray, values ] of cases) {
    const byteLength = values.length * TypedArray.BYTES_PER_ELEMENT;
    const fixed = new SharedArrayBuffer(byteLength);
    const growable = new SharedArrayBuffer(byteLength, { maxByteLength: byteLength * 2 });

    for (const sab of [ fixed, growable ]) {
        const arr = new TypedArray(sab);

        for (let i = 0; i < values.length; i++) {
            arr[i] = values[i];
        }

        for (let i = 0; i < values.length; i++) {
            assert.eq(arr[i], values[i], `${TypedArray.name}[${i}] reads back`);
        }

        arr.reverse();
        assert.eq(Array.from(arr), values.toReversed(), `${TypedArray.name} reverse()`);

        arr.sort();

        const sorted = values.toSorted((a, b) => (a < b ? -1 : Number(a > b)));

        assert.eq(Array.from(arr), sorted, `${TypedArray.name} sort()`);
    }
}
