// A multipart/form-data body must be parseable back into a FormData via
// Response.prototype.formData(), preserving string fields, repeated fields,
// and File parts (filename, type, and raw bytes).
import assert from 'tjs:assert';


const fileBytes = new Uint8Array([ 0x00, 0x01, 0xff, 0x7f, 0x80, 0x0a, 0x0d, 0x2a ]);

const fd = new FormData();

fd.append('greeting', 'hello world');
fd.append('multi', 'one');
fd.append('multi', 'two');
fd.append('upload', new Blob([ fileBytes ], { type: 'image/png' }), 'pic.png');

// Serialize as a request body, then parse it back as a response body.
const req = new Request('http://example.invalid/', { method: 'POST', body: fd });
const contentType = req.headers.get('content-type');
const serialized = await req.arrayBuffer();

const resp = new Response(serialized, { headers: { 'content-type': contentType } });
const parsed = await resp.formData();

assert.eq(parsed.get('greeting'), 'hello world', 'string field round-trips');
assert.eq(parsed.getAll('multi').join(','), 'one,two', 'repeated field preserves order and count');

const file = parsed.get('upload');

assert.ok(file instanceof File, 'file part is a File');
assert.eq(file.name, 'pic.png', 'filename preserved');
assert.eq(file.type, 'image/png', 'content-type preserved');
assert.eq(file.size, fileBytes.length, 'file size preserved');

const back = new Uint8Array(await file.arrayBuffer());

assert.eq(back.length, fileBytes.length, 'file byte length preserved');

for (let i = 0; i < fileBytes.length; i++) {
    assert.eq(back[i], fileBytes[i], `file byte ${i} preserved`);
}

// A multipart content-type with no boundary parameter must reject.
const noBoundary = new Response('garbage', { headers: { 'content-type': 'multipart/form-data' } });
let threw = false;

try {
    await noBoundary.formData();
} catch (e) {
    threw = e instanceof TypeError;
}

assert.ok(threw, 'multipart body without boundary rejects with TypeError');
