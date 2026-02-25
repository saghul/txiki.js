import assert from 'tjs:assert';

const testData = 'Hello, World! This is a test of the compression streams API. '
    + 'It should handle various data sizes and formats correctly. '
    + 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function compress(data, format) {
    const cs = new CompressionStream(format);
    const writer = cs.writable.getWriter();
    const reader = cs.readable.getReader();

    const chunks = [];

    writer.write(data);
    writer.close();

    while (true) {
        const { value, done } = await reader.read();

        if (done) {
            break;
        }

        chunks.push(value);
    }

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return result;
}

async function decompress(data, format) {
    const ds = new DecompressionStream(format);
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();

    const chunks = [];

    writer.write(data);
    writer.close();

    while (true) {
        const { value, done } = await reader.read();

        if (done) {
            break;
        }

        chunks.push(value);
    }

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return result;
}

// Test gzip roundtrip.
async function testGzip() {
    const input = encoder.encode(testData);
    const compressed = await compress(input, 'gzip');

    assert.ok(compressed.length > 0, 'gzip compressed data should not be empty');
    assert.ok(compressed.length < input.length, 'gzip compressed should be smaller');

    // Check gzip magic bytes.
    assert.eq(compressed[0], 0x1f, 'gzip magic byte 1');
    assert.eq(compressed[1], 0x8b, 'gzip magic byte 2');

    const decompressed = await decompress(compressed, 'gzip');
    const output = decoder.decode(decompressed);

    assert.eq(output, testData, 'gzip roundtrip should preserve data');
}

// Test deflate (zlib) roundtrip.
async function testDeflate() {
    const input = encoder.encode(testData);
    const compressed = await compress(input, 'deflate');

    assert.ok(compressed.length > 0, 'deflate compressed data should not be empty');
    assert.ok(compressed.length < input.length, 'deflate compressed should be smaller');

    const decompressed = await decompress(compressed, 'deflate');
    const output = decoder.decode(decompressed);

    assert.eq(output, testData, 'deflate roundtrip should preserve data');
}

// Test deflate-raw roundtrip.
async function testDeflateRaw() {
    const input = encoder.encode(testData);
    const compressed = await compress(input, 'deflate-raw');

    assert.ok(compressed.length > 0, 'deflate-raw compressed data should not be empty');
    assert.ok(compressed.length < input.length, 'deflate-raw compressed should be smaller');

    const decompressed = await decompress(compressed, 'deflate-raw');
    const output = decoder.decode(decompressed);

    assert.eq(output, testData, 'deflate-raw roundtrip should preserve data');
}

// Test with empty data.
async function testEmpty() {
    const input = new Uint8Array(0);

    for (const format of [ 'gzip', 'deflate', 'deflate-raw' ]) {
        const compressed = await compress(input, format);

        assert.ok(compressed.length > 0, `${format} compressed empty data should have overhead bytes`);

        const decompressed = await decompress(compressed, format);

        assert.eq(decompressed.length, 0, `${format} decompressed empty should be empty`);
    }
}

// Test with larger data.
async function testLargeData() {
    const size = 100000;
    const input = new Uint8Array(size);

    for (let i = 0; i < size; i++) {
        input[i] = i % 256;
    }

    for (const format of [ 'gzip', 'deflate', 'deflate-raw' ]) {
        const compressed = await compress(input, format);

        assert.ok(compressed.length > 0, `${format} compressed large data should not be empty`);
        assert.ok(compressed.length < input.length, `${format} compressed should be smaller for repetitive data`);

        const decompressed = await decompress(compressed, format);

        assert.eq(decompressed.length, input.length, `${format} decompressed should have same length`);
        assert.eq(decoder.decode(decompressed), decoder.decode(input), `${format} roundtrip should preserve large data`);
    }
}

// Test invalid format.
async function testInvalidFormat() {
    let threw = false;

    try {
        new CompressionStream('invalid');
    } catch (e) {
        threw = true;
        assert.ok(e instanceof TypeError, 'should throw TypeError for invalid format');
    }

    assert.ok(threw, 'should throw for invalid compression format');

    threw = false;

    try {
        new DecompressionStream('invalid');
    } catch (e) {
        threw = true;
        assert.ok(e instanceof TypeError, 'should throw TypeError for invalid format');
    }

    assert.ok(threw, 'should throw for invalid decompression format');
}

await testGzip();
await testDeflate();
await testDeflateRaw();
await testEmpty();
await testLargeData();
await testInvalidFormat();
