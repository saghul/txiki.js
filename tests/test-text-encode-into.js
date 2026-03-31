import assert from 'tjs:assert';

// Basic ASCII encoding
{
    const encoder = new TextEncoder();
    const buf = new Uint8Array(10);
    const result = encoder.encodeInto('Hello', buf);
    assert.eq(result.read, 5);
    assert.eq(result.written, 5);
    assert.eq(buf[0], 0x48); // H
    assert.eq(buf[1], 0x65); // e
    assert.eq(buf[2], 0x6c); // l
    assert.eq(buf[3], 0x6c); // l
    assert.eq(buf[4], 0x6f); // o
    assert.eq(buf[5], 0);    // untouched
}

// Multi-byte characters (euro sign = 3 bytes)
{
    const encoder = new TextEncoder();
    const buf = new Uint8Array(10);
    const result = encoder.encodeInto('\u20AC', buf);
    assert.eq(result.read, 1);
    assert.eq(result.written, 3);
    assert.eq(buf[0], 0xe2);
    assert.eq(buf[1], 0x82);
    assert.eq(buf[2], 0xac);
}

// Astral character (emoji, surrogate pair in UTF-16 = 4 bytes, read=2)
{
    const encoder = new TextEncoder();
    const buf = new Uint8Array(10);
    const result = encoder.encodeInto('\u{1F600}', buf);
    assert.eq(result.read, 2);
    assert.eq(result.written, 4);
    assert.eq(buf[0], 0xf0);
    assert.eq(buf[1], 0x9f);
    assert.eq(buf[2], 0x98);
    assert.eq(buf[3], 0x80);
}

// Truncation: buffer too small for full string
{
    const encoder = new TextEncoder();
    const buf = new Uint8Array(3);
    const result = encoder.encodeInto('Hello', buf);
    assert.eq(result.read, 3);
    assert.eq(result.written, 3);
    assert.eq(buf[0], 0x48);
    assert.eq(buf[1], 0x65);
    assert.eq(buf[2], 0x6c);
}

// Buffer too small for a multi-byte character
{
    const encoder = new TextEncoder();
    const buf = new Uint8Array(2);
    const result = encoder.encodeInto('\u20AC', buf);
    assert.eq(result.read, 0);
    assert.eq(result.written, 0);
}

// Empty string
{
    const encoder = new TextEncoder();
    const buf = new Uint8Array(5);
    const result = encoder.encodeInto('', buf);
    assert.eq(result.read, 0);
    assert.eq(result.written, 0);
}

// Zero-length buffer
{
    const encoder = new TextEncoder();
    const buf = new Uint8Array(0);
    const result = encoder.encodeInto('abc', buf);
    assert.eq(result.read, 0);
    assert.eq(result.written, 0);
}

// Mixed ASCII and astral
{
    const encoder = new TextEncoder();
    const buf = new Uint8Array(10);
    const result = encoder.encodeInto('A\u{1F600}B', buf);
    // A=1byte, emoji=4bytes, B=1byte => read=4 (1+2+1), written=6
    assert.eq(result.read, 4);
    assert.eq(result.written, 6);
}

// Partial: buffer fits ASCII prefix but not the following multi-byte char
{
    const encoder = new TextEncoder();
    const buf = new Uint8Array(2);
    const result = encoder.encodeInto('A\u20AC', buf);
    assert.eq(result.read, 1);
    assert.eq(result.written, 1);
}

// Round-trip: encodeInto matches encode
{
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const input = 'I \u{1F499} streams';
    const encoded = encoder.encode(input);
    const buf = new Uint8Array(encoded.length);
    const result = encoder.encodeInto(input, buf);
    assert.eq(result.written, encoded.length);
    assert.eq(decoder.decode(buf), input);
}
