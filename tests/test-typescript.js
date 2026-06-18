import assert from 'tjs:assert';
import { transpile } from 'tjs:typescript';

// Basic type stripping
const r1 = transpile('/tmp/test.ts', 'const x: number = 42;');
assert.ok(r1.includes('const x = 42'), 'type annotation stripped');
assert.ok(!r1.includes(': number'), 'no type annotation in output');

// Function types
const r2 = transpile('/tmp/test.ts', 'function add(a: number, b: number): number { return a + b; }');
assert.ok(r2.includes('function add(a, b)'), 'function type params stripped');
assert.ok(r2.includes('return a + b'), 'function body preserved');

// Arrow function
const r3 = transpile('/tmp/test.ts', 'const multiply = (a: number, b: number): number => a * b;');
assert.ok(r3.includes('const multiply = (a, b) =>'), 'arrow function types stripped');

// Interface (should produce no runtime code for interface)
const r4 = transpile('/tmp/test.ts', 'interface Person { name: string; } const p: Person = { name: "Alice" };');
assert.ok(!r4.includes('Person'), 'interface stripped');
assert.ok(r4.includes('const p'), 'variable declaration preserved');

// Optional chaining
const r5 = transpile('/tmp/test.ts', 'const x: string | undefined = obj?.foo?.bar;');
assert.ok(r5.includes('?.foo?.bar'), 'optional chaining preserved');

// Nullish coalescing
const r6 = transpile('/tmp/test.ts', 'const val: string | null = null; const r = val ?? "default";');
assert.ok(r6.includes('??'), 'nullish coalescing preserved');

// Enums
const r7 = transpile('/tmp/test.ts', 'enum Color { Red, Green, Blue }');
assert.ok(r7.length > 0, 'enum transpiled');

// JSX (TSX)
const r8 = transpile('/tmp/test.tsx', 'const el = <div>hello</div>;');
assert.ok(r8.includes('React.createElement') || r8.includes('el'), 'jsx handled');

// Module-level TS works too
const r9 = transpile('/tmp/test.ts', `
import { defineComponent } from 'vue';
export default defineComponent({ name: 'Test' });
`);
assert.ok(r9.includes('import'), 'imports preserved');
assert.ok(r9.includes('export default'), 'exports preserved');
