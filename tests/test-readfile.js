import assert from 'tjs:assert';
import path from 'tjs:path';


const data = await tjs.readFile(path.join(import.meta.dirname, import.meta.basename));

assert.eq(data[Symbol.toStringTag], 'Uint8Array', 'returns Uint8Array');
