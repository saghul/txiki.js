import assert from 'tjs:assert';

// Test importing TS files from JS - explicit extension
const greetMod = await import('./fixtures/greet.ts');
const greeting = greetMod.greet('World');
assert.equal(greeting, 'Hello World');

// Test importing TS files from JS - automatic extension resolution
const addMod = await import('./fixtures/add');
const sum = addMod.add(10, 20);
assert.equal(sum, 30);
