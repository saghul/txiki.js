import assert from 'tjs:assert';


tjs.env.FOO = 123;
assert.eq(tjs.env.FOO, '123');
tjs.env.FOO = 'BAR';
assert.eq(tjs.env.FOO, 'BAR');
delete tjs.env.FOO;
assert.eq(tjs.env.FOO, undefined);
