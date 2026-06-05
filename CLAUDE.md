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
BUILD_WITH_WASM=OFF make      # Disable WebAssembly / WAMR (saves ~0.4 MB)
BUILD_WITH_SQLITE=OFF make    # Disable SQLite (saves ~1.6 MB)
BUILD_WITH_TLS=OFF make       # Disable TLS/HTTPS/WSS (saves ~0.7 MB; WebCrypto unaffected)
BUILD_WITH_STRIP=ON make      # Strip symbol table from binary after linking (saves ~0.3–0.5 MB)
BUILD_WITH_LTO=ON make        # Enable link-time optimization (saves ~0.3 MB, slower link)
BUILDTYPE=MinSizeRel make     # Optimize for size instead of speed (-Os, saves ~0.2–0.4 MB)
```

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

## Running Tests

```bash
./build/tjs test tests/                    # All tests
./build/tjs run tests/test-something.js    # Single test file (use "run", not "test")
VERBOSE_TESTS=1 ./build/tjs test tests/    # Verbose output
```

Test files must be named `test-*.js` and live in `tests/`. They use `tjs:assert` for assertions.

### Feature-gated tests

When a test file requires a feature that can be compiled out
(`BUILD_WITH_WASM=OFF`, `BUILD_WITH_SQLITE=OFF`, `BUILD_WITH_TLS=OFF`), add its
filename or glob to the appropriate key in `tests/feature-skip.json`. The test
runner reads this file and skips matched tests on builds where the feature is
absent. Only `*` wildcards at a single position are supported (no `**`, no `?`).

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

### Patching vendored dependencies

All modifications to `deps/` must be committed as `.patch` files in `patches/`
and applied via the `apply_dep_patch` CMake macro. Patches are applied idempotently
at configure time — submodule resets are self-healing.

To patch a dep:
```bash
cd deps/<dep>
# make edits
git diff > ../../patches/<dep>.patch
```
Then add `apply_dep_patch(DEPDIR deps/<dep> PATCH patches/<dep>.patch)` immediately
before the dep's `add_subdirectory` line in `CMakeLists.txt`.

Never edit `deps/` files directly without a corresponding patch file.

## Code Conventions

- C code follows `.clang-format` style; run `make format` before committing
- Prefer `Promise.withResolvers()` for deferred promises
- Platform-specific C code uses `#ifdef _WIN32` / `#ifndef _WIN32` guards
- Stdlib modules are imported as `tjs:modulename` (e.g., `import assert from 'tjs:assert'`)
