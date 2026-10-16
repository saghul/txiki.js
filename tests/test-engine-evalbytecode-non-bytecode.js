import assert from 'tjs:assert';

const o = { mark: 'alive' };

for (let i = 0; i < 20; i++) {
    assert.throws(() => tjs.engine.evalBytecode(o), TypeError);
}

assert.eq(JSON.stringify(o), '{"mark":"alive"}', 'the argument is still alive');

for (let i = 0; i < 20; i++) {
    try {
        tjs.engine.evalBytecode(tjs.engine);
    } catch {
        // Expected: not a bytecode value.
    }
}

assert.eq(typeof tjs.engine.evalBytecode, 'function', 'tjs.engine is still alive');
