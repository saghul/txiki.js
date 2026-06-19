# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

txiki.js is a small JavaScript runtime built on QuickJS-ng (JS engine), libuv (platform I/O), and libwebsockets (HTTP/WebSocket). It targets WinterTC compliance and provides Web Platform APIs.

## Build Commands

```bash
make                # Build (Release). Output: build/tjs
make debug          # Build (Debug)
make js             # Rebuild JS bundles only (after editing src/js/)
make test           # Run all tests
make test-advanced  # Run advanced/integration tests (requires npm install in tests/advanced/)
make format         # Run clang-format on C sources
make lint           # Run ESLint on JS sources
```

After modifying files in `src/js/`, run `make js && make` to rebuild.

After modifying C files, just run `make`.

### Build Options

```bash
BUILDTYPE=Debug make          # Debug build
MIMALLOC=OFF make             # Disable mimalloc (required for ASAN)
BUILD_WITH_ASAN=ON MIMALLOC=OFF make  # Enable AddressSanitizer (must disable mimalloc)
BUILD_WITH_UBSAN=ON make      # Enable UndefinedBehaviorSanitizer (Linux/macOS only)
BUILD_WITH_GC_STRESS=ON make  # Force a full GC before every JS allocation (GC stress)
BUILD_WITH_WASM=OFF make      # Disable WebAssembly / WAMR (drops the WebAssembly global and tjs:wasi)
BUILD_WITH_SQLITE=OFF make    # Disable SQLite (drops the tjs:sqlite module; localStorage falls back to in-memory)
```

#### Size-optimized builds

These flags shrink the binary; they are orthogonal to one another and can be combined.

```bash
BUILD_WITH_STRIP=ON make        # Strip the symbol table from the binary after linking
BUILD_WITH_LTO=ON make          # Enable link-time optimization (slower link, smaller/faster binary)
BUILD_WITH_GC_SECTIONS=ON make  # Per-function/data sections + linker dead-code stripping
BUILDTYPE=MinSizeRel make       # Optimize for size instead of speed (-Os)
```

`BUILD_WITH_STRIP` runs `${CMAKE_STRIP}` as a post-build step (skipped when `CMAKE_STRIP` is
unset, e.g. MSVC). `BUILD_WITH_LTO` falls back to a warning if the toolchain can't do IPO.
`BUILD_WITH_GC_SECTIONS` maps to `-Wl,--gc-sections` (GNU/lld), `-Wl,-dead_strip` (Apple), or
`/OPT:REF /OPT:ICF` (MSVC). `BUILDTYPE=MinSizeRel` is a standard CMake build type (no extra flag).

ASAN and mimalloc are mutually exclusive. UBSAN is not supported on MSVC.

### Sanitizer Builds

**ASAN** (AddressSanitizer): Detects memory errors (use-after-free, buffer overflow, etc.).
```bash
cmake -B build-asan -DCMAKE_BUILD_TYPE=RelWithDebInfo -DBUILD_WITH_ASAN=ON -DBUILD_WITH_MIMALLOC=OFF
cmake --build build-asan
./build-asan/tjs test tests/
```

**UBSAN** (UndefinedBehaviorSanitizer): Detects undefined behavior (misaligned access, integer overflow, etc.).
```bash
cmake -B build-ubsan -DCMAKE_BUILD_TYPE=RelWithDebInfo -DBUILD_WITH_UBSAN=ON
cmake --build build-ubsan
UBSAN_OPTIONS="halt_on_error=1:suppressions=$(pwd)/ubsan.supp" ./build-ubsan/tjs test tests/
```

UBSAN requires a suppressions file (`ubsan.supp`) for known issues in vendored dependencies (WAMR alignment). Fix UBSan issues in our own code (`src/`) rather than adding suppression rules.

### GC Stress Testing

`BUILD_WITH_GC_STRESS=ON` defines QuickJS's `FORCE_GC_AT_MALLOC`, which runs a full garbage collection before *every* JS object allocation. This surfaces GC bugs — objects that are collected while still referenced (missing GC roots / mark hooks). Such premature frees usually only manifest as use-after-free, so combine it with ASAN to actually catch them:
```bash
cmake -B build-gcstress -DCMAKE_BUILD_TYPE=RelWithDebInfo -DBUILD_WITH_GC_STRESS=ON -DBUILD_WITH_ASAN=ON -DBUILD_WITH_MIMALLOC=OFF
cmake --build build-gcstress
TJS_GC_STRESS=1 ./build-gcstress/tjs test tests/
```

Set `TJS_GC_STRESS=1` when running the test suite against a GC-stress build: a full GC before every allocation starves the event loop, so a handful of timing-sensitive tests (e.g. `test-performance`) skip themselves when that variable is set rather than failing on wall-clock assertions. The first `tjs bundle` call (esbuild download) is implemented in JS and is pathologically slow under GC stress, so the CI job warms the shared `~/.tjs` esbuild cache with a normal build first.

GC stress is orthogonal to the allocator and the sanitizers; it just changes the GC trigger threshold. It makes execution drastically slower (a full GC per allocation), so the CI job runs it on Linux only.

## Running Tests

```bash
./build/tjs test tests/                    # All tests
./build/tjs run tests/test-something.js    # Single test file (use "run", not "test")
VERBOSE_TESTS=1 ./build/tjs test tests/    # Verbose output
```

Test files must be named `test-*.js` and live in `tests/`. They use `tjs:assert` for assertions.

**One test, one file.** Each test file should cover a single feature or behavior. Prefer
splitting distinct behaviors into separate `test-*.js` files (e.g. `test-fetch-h2-post-body.js`,
`test-fetch-h2-empty-body.js`) over accumulating many unrelated cases in one file — a focused
file is easier to run in isolation (`tjs run tests/test-foo.js`) and makes a failure point
directly at the behavior that broke.

### Feature-gated tests

When a test file requires a feature that can be compiled out (e.g. `BUILD_WITH_WASM=OFF`),
add its filename or glob to the matching feature key in `tests/feature-skip.json`. The test
runner reads this file and skips matched tests on builds where the feature is absent
(detected via `tjs.engine.features`). Only `*` wildcards at a single position are supported
(no `**`, no `?`).

## Architecture

### Two-Layer Design: C modules + JS polyfills

**C layer** (`src/`): Native modules (`mod_*.c`) expose low-level APIs to JS via QuickJS bindings. Key files:
- `vm.c` / `private.h` — TJSRuntime lifecycle (QuickJS runtime + libuv loop)
- `builtins.c` — Registers all native modules
- `cli.c` — Entry point, CLI argument parsing
- `mod_*.c` — Native module implementations (fs, os, process, dns, udp, tls, sqlite3, ffi, etc.)
- `httpclient.c` / `httpserver.c` / `ws.c` — HTTP and WebSocket via libwebsockets
- `webcrypto.c` — Web Crypto API
- `wasm.c` — WebAssembly via WAMR

**JS layer** (`src/js/`): Builds on C APIs to implement Web Platform interfaces.
- `polyfills/` — Browser API polyfills (EventTarget, fetch, WebSocket, console, crypto, etc.). **Import order in `index.js` matters** — dependencies before dependents.
- `core/` — Initializes the `tjs` global object
- `stdlib/` — Standard library modules importable as `tjs:modulename` (path, fs, http, sqlite, ffi, etc.)
- `run-main/` — CLI subcommands (test runner, bundler, compiler)
- `run-repl/` — REPL implementation
- `worker/` — Web Worker bootstrap

### JS Bundle Pipeline

JS source → esbuild bundle → tjsc (QuickJS bytecode compiler) → C byte arrays → compiled into binary.

Generated files live in `src/bundles/` (git-ignored). The Makefile `js` target runs this pipeline.

### Dependencies (deps/)

All vendored as git submodules: quickjs, libuv, mimalloc, sqlite3, libwebsockets, mbedtls, wamr, miniz, tweetnacl, ada.

## Code Conventions

- C code follows `.clang-format` style; run `make format` before committing
- Prefer `Promise.withResolvers()` for deferred promises
- Platform-specific C code uses `#ifdef _WIN32` / `#ifndef _WIN32` guards
- Stdlib modules are imported as `tjs:modulename` (e.g., `import assert from 'tjs:assert'`)
