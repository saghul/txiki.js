// A FormData fetch body must be serialized as multipart/form-data with the
// file/blob parts carried as raw bytes — not urlencoded (which silently
// stringifies File/Blob to "[object File]" and drops their bytes).
import assert from 'tjs:assert';


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

const fd = new FormData();

fd.append('greeting', 'hello world');
const fileBytes = new Uint8Array([ 0x00, 0x01, 0xff, 0x7f, 0x80, 0x0a, 0x0d ]);

fd.append('upload', new Blob([ fileBytes ], { type: 'application/octet-stream' }), 'data.bin');

const req = new Request('http://example.invalid/', { method: 'POST', body: fd });

const contentType = req.headers.get('content-type');

assert.ok(
    contentType.startsWith('multipart/form-data; boundary='),
    'content-type is multipart/form-data with a boundary'
);

const body = new Uint8Array(await req.arrayBuffer());

// Decode as latin1 by hand: TextDecoder only supports UTF-8, and the body
// contains non-UTF-8 bytes (the raw file payload) anyway.
let decoded = '';

for (const b of body) {
    decoded += String.fromCharCode(b);
}

// The string field round-trips.
assert.ok(decoded.includes('name="greeting"'), 'string field disposition present');
assert.ok(decoded.includes('hello world'), 'string field value present');

// The file part carries its filename + content-type header...
assert.ok(decoded.includes('name="upload"; filename="data.bin"'), 'file disposition present');
assert.ok(decoded.includes('Content-Type: application/octet-stream'), 'file content-type present');

// ...and, crucially, its raw bytes (the regression: they used to be dropped).
assert.ok(indexOfBytes(body, fileBytes) !== -1, 'raw file bytes are present in the serialized body');

// It must NOT be the old urlencoded serialization.
assert.ok(!decoded.includes('[object File]'), 'blob is not stringified to [object File]');
assert.ok(!decoded.includes('[object Blob]'), 'blob is not stringified to [object Blob]');
assert.ok(!decoded.includes('upload=%5Bobject'), 'body is not urlencoded');
