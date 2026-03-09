import assert from 'tjs:assert';

const encoder = new TextEncoder();

// Test 1: stdout writer can be reused after close + releaseLock.
for (const label of [ 'first', 'second', 'third' ]) {
    assert.eq(tjs.stdout.locked, false, `stdout should not be locked before ${label} iteration`);

    const writer = tjs.stdout.getWriter();
    assert.eq(tjs.stdout.locked, true, 'stdout should be locked after getWriter');

    await writer.write(encoder.encode(`${label}\n`));
    await writer.close();
    await writer.closed;
    writer.releaseLock();

    assert.eq(tjs.stdout.locked, false, `stdout should not be locked after ${label} releaseLock`);
}

// Test 2: stderr writer can be reused after close + releaseLock.
for (const label of [ 'first', 'second' ]) {
    const writer = tjs.stderr.getWriter();
    await writer.write(encoder.encode(`stderr ${label}\n`));
    await writer.close();
    await writer.closed;
    writer.releaseLock();

    assert.eq(tjs.stderr.locked, false, `stderr should not be locked after ${label} releaseLock`);
}

// Test 3: stdin reader can be reused after cancel + releaseLock.
// (Only testable when stdin is a pipe, which it is during test runs.)
if (tjs.stdin.type === 'pipe') {
    const reader = tjs.stdin.getReader();
    assert.eq(tjs.stdin.locked, true, 'stdin should be locked after getReader');
    await reader.cancel();
    reader.releaseLock();
    assert.eq(tjs.stdin.locked, false, 'stdin should not be locked after cancel + releaseLock');
}
