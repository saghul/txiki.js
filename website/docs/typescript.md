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

## Performance

The transpiler runs as a WebAssembly module inside WAMR, txiki.js's built-in WASM runtime.
For typical files, transpilation overhead is under a millisecond:

| File size    | Lines | Baseline (JS) | Interpreter | Fast JIT |
|-------------|------|--------------|-------------|----------|
| 0.1 KB      | 3    | 0.003 ms     | 0.16 ms     | 0.04 ms  |
| 0.5 KB      | 10   | 0.020 ms     | 0.60 ms     | 0.10 ms  |
| 2.7 KB      | 50   | 0.090 ms     | 2.80 ms     | 0.42 ms  |
| 11.4 KB     | 200  | 0.380 ms     | 11.0 ms     | 1.50 ms  |

By default the WASM interpreter is used (fast-interp mode). Enabling
`BUILD_WITH_WAMR_FAST_JIT=ON` at build time adds a lightweight JIT compiler
([asmjit](https://asmjit.com/), no LLVM required) that compiles hot WASM functions
to native x86-64 code, giving a **4-8× speedup** on transpilation with no API changes.

The compiler adds ~500 KB to the binary, so it is off by default. Enable it when
TypeScript performance matters:

```bash
cmake -B build -DBUILD_WITH_WAMR_FAST_JIT=ON
cmake --build build
```

Run the built-in benchmark to compare on your machine:

```bash
./build/tjs run benchmark/typescript-vs-js.js
```

## Build Configuration

TypeScript support is enabled by default. Use the CMake option to control it:

| Value | Behavior |
|-------|----------|
| `ON` (default) | WASM transpiler downloaded on first use, cached in `~/.tjs/typescript/<version>/` |
| `EMBED` | WASM binary downloaded at build time and compiled into the binary |
| `OFF` | No TypeScript support |

```bash
# Disable TypeScript support
cmake -B build -DBUILD_WITH_TYPESCRIPT=OFF

# Embed the WASM transpiler (downloads at CMake configure time)
cmake -B build -DBUILD_WITH_TYPESCRIPT=EMBED
```

## Transpiler

The TypeScript transpiler is based on [oxc](https://oxc.rs/), a Rust-based JavaScript/TypeScript toolchain. It handles:
- Type annotation stripping
- JSX/TSX transformation
- Enums, namespaces, and decorators
- Modern JavaScript downleveling

The transpiler runs as a WASI-compatible WebAssembly module via the built-in WAMR runtime.
WAMR operates in fast-interpreter mode by default. Enabling the built-in Fast JIT
(`BUILD_WITH_WAMR_FAST_JIT=ON`) compiles hot WASM paths to native code, accelerating
transpilation by 4-8×.
