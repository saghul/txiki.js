---
sidebar_position: 3
title: TypeScript
---

# TypeScript

txiki.js can run TypeScript files directly using its built-in WASM TypeScript transpiler.

## Usage

```bash
# Run a TypeScript file
tjs run file.ts

# Run a TypeScript file with JSX
tjs run component.tsx

# Compile a TypeScript file into a standalone executable
tjs compile file.ts output
```

TypeScript files are transpiled to JavaScript at module load time using the oxc transpiler running inside txiki.js's built-in WAMR WebAssembly runtime. The transpilation is transparent — `.ts`, `.tsx`, `.mts`, and `.cts` files work alongside `.js` files.

## Import Resolution

Import statements with explicit `.ts` extensions work directly:

```ts
import { foo } from './bar.ts';
```

For extensionless imports, txiki.js automatically tries resolving with these extensions in order:
`.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.mjs`, `.cjs`.

```ts
import { foo } from './bar';  // resolves ./bar.ts, ./bar.tsx, etc.
import { baz } from './utils'; // resolves ./utils.ts, etc.
```

## Type Definitions

txiki.js provides TypeScript type definitions via the [@txikijs/types](https://www.npmjs.com/package/@txikijs/types) npm package, enabling autocompletion and type checking in your editor.

```bash
npm install @txikijs/types --save-dev
```

## Build Configuration

TypeScript support is enabled by default. Use the CMake option to control it:

| Value | Behavior |
|-------|----------|
| `ON` (default) | WASM transpiler downloaded on first use, cached in `~/.tjs/typescript/` |
| `EMBED` | WASM binary compiled into the txiki.js binary |
| `OFF` | No TypeScript support |

```bash
# Disable TypeScript support
cmake -B build -DBUILD_WITH_TYPESCRIPT=OFF

# Embed the WASM transpiler
cmake -B build -DBUILD_WITH_TYPESCRIPT=EMBED
```

## Transpiler

The TypeScript transpiler is based on [oxc](https://oxc.rs/), a Rust-based JavaScript/TypeScript toolchain. It handles:
- Type annotation stripping
- JSX/TSX transformation
- Enums, namespaces, and decorators
- Modern JavaScript downleveling

The transpiler runs as a WASI-compatible WebAssembly module via the built-in WAMR runtime.
