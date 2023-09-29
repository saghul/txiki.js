import assert from 'tjs:assert';

function test_number()
{
    assert.eq(parseInt("123"), 123);
    assert.eq(parseInt("  123r"), 123);
    assert.eq(parseInt("0x123"), 0x123);
    assert.eq(parseInt("0o123"), 0);
    assert.eq(+"  123   ", 123);
    assert.eq(+"0b111", 7);
    assert.eq(+"0o123", 83);
    assert.eq(parseFloat("0x1234"), 0);
    assert.eq(parseFloat("Infinity"), Infinity);
    assert.eq(parseFloat("-Infinity"), -Infinity);
    assert.eq(parseFloat("123.2"), 123.2);
    assert.eq(parseFloat("123.2e3"), 123200);
    assert.ok(Number.isNaN(Number("+")));
    assert.ok(Number.isNaN(Number("-")));
    assert.ok(Number.isNaN(Number("\x00a")));

    // assert.eq((25).toExponential(0), "3e+1");
    // assert.eq((-25).toExponential(0), "-3e+1");
    // assert.eq((2.5).toPrecision(1), "3");
    // assert.eq((-2.5).toPrecision(1), "-3");
    // assert.eq((1.125).toFixed(2), "1.13");
    // assert.eq((-1.125).toFixed(2), "-1.13");
}

test_number()