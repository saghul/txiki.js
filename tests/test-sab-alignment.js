import assert from 'tjs:assert';
import FFI from 'tjs:ffi';

const { bufferToPointer } = FFI;

for (const size of [ 1, 255, 4096 ]) {
    const fixed = new SharedArrayBuffer(size);
    const growable = new SharedArrayBuffer(size, { maxByteLength: size * 2 });

    for (const sab of [ fixed, growable ]) {
        const addr = bufferToPointer(new Uint8Array(sab)).value;

        assert.eq(addr % 8n, 0n, `SharedArrayBuffer(${size}) data is 8-byte aligned (growable: ${sab.growable})`);
    }
}
