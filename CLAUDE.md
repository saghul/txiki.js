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

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->