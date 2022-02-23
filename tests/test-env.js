import assert from './assert.js';


(async () => {
    assert.throws(() => { tjs.getenv() }, TypeError, 'must pass a string');
    assert.throws(() => { tjs.getenv(1234) }, TypeError, 'must pass a string');
    assert.ok(tjs.getenv('PATH'));

    assert.throws(() => { tjs.setenv() }, TypeError, 'must pass a string');
    assert.throws(() => { tjs.setenv('FOO') }, TypeError, 'must pass a string');
    tjs.setenv('FOO', 123);
    tjs.setenv('FOO', 'BAR');

    assert.throws(() => { tjs.unsetenv() }, TypeError, 'must pass a string');
    assert.throws(() => { tjs.unsetenv(1234) }, TypeError, 'must pass a string');
    tjs.unsetenv('FOO');
})();
