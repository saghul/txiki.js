import assert from 'tjs:assert';

assert.throws(() => {
    tjs.watch('/nonexistent/path/does/not/exist', () => {});
});
