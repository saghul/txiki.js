// End-to-end: a FormData body posted via fetch must reach the server intact,
// including the raw bytes of a File/Blob part, carried over the wire as a
// multipart/form-data request.
import assert from 'tjs:assert';

import { spawnServe } from './helpers/serve-spawn.js';


function indexOfBytes(haystack, needle, from = 0) {
    outer: for (let i = from; i <= haystack.length - needle.length; i++) {
        for (let j = 0; j < needle.length; j++) {
            if (haystack[i + j] !== needle[j]) {
                continue outer;
            }
        }

        return i;
    }

    return -1;
}

const { proc, port } = await spawnServe('serve-body-echo.js');

try {
    const fd = new FormData();

    fd.append('field', 'a value');
    const fileBytes = new Uint8Array([ 0xde, 0xad, 0xbe, 0xef, 0x00, 0x0a ]);

    fd.append('file', new Blob([ fileBytes ], { type: 'application/octet-stream' }), 'blob.bin');

    const resp = await fetch(`http://127.0.0.1:${port}/`, { method: 'POST', body: fd });

    assert.eq(resp.status, 200, 'status is 200');

    // The server received a multipart/form-data content-type with a boundary.
    const echoedCT = resp.headers.get('x-echo-content-type');

    assert.ok(
        echoedCT.startsWith('multipart/form-data; boundary='),
        'server saw multipart/form-data content-type'
    );

    // The raw body that reached the server still contains the file's bytes.
    const echoed = new Uint8Array(await resp.arrayBuffer());

    assert.ok(indexOfBytes(echoed, fileBytes) !== -1, 'file bytes survived the round-trip');
} finally {
    proc.kill('SIGTERM');
    await proc.wait();
}
