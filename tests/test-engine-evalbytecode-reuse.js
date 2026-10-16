import assert from 'tjs:assert';

const enc = new TextEncoder();
const bc = tjs.engine.compile(enc.encode('globalThis.__n = (globalThis.__n ?? 0) + 1'), 'evalbytecode-reuse');

for (let i = 0; i < 3; i++) {
    await tjs.engine.evalBytecode(bc);
}

// compile() produces a module, and a module body only runs once.
assert.eq(globalThis.__n, 1, 'the same bytecode can be evaluated repeatedly');

await tjs.engine.evalBytecode(tjs.engine.compile(enc.encode('globalThis.__m = 42'), 'evalbytecode-temp'));

assert.eq(globalThis.__m, 42, 'a temporary bytecode value can be evaluated');
