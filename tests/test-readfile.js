import assert from 'tjs:assert';


const data = await tjs.readFile(import.meta.path);

assert.eq(data[Symbol.toStringTag], 'Uint8Array', 'returns Uint8Array');
