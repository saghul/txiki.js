import assert from 'tjs:assert';

async function rejects(specifier, check, message) {
    let error;

    try {
        await import(specifier);
    } catch (e) {
        error = e;
    }

    assert.ok(error !== undefined, `${message}: import rejects`);
    check(error);
}

const isTypeError = e => assert.ok(e instanceof TypeError, `expected TypeError, got ${e}`);

await rejects('file://example.com/x.js', isTypeError, 'non-local host');
await rejects('file:///foo%00.js', isTypeError, 'encoded NUL');
await rejects('file:///foo%zz.js', isTypeError, 'invalid escape');
await rejects('file:///foo%2.js', isTypeError, 'truncated escape');
await rejects('file://', isTypeError, 'no path');
await rejects('file:///nonexistent-tjs-file-url.js', e => assert.ok(e instanceof Error), 'missing file');
