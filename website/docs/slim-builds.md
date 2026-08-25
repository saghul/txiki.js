---
sidebar_position: 1
title: Slim builds
---

import ForkNotice from '@site/src/components/ForkNotice';

# Slim builds

<ForkNotice />

This fork adds build-time options on top of the ones documented in
[Building](./building.md). They fall into two groups: options that **remove a feature**
(smaller binary, smaller API surface) and options that only change **how the code is compiled
and linked** (smaller binary, same features).

All of them live in `cmake/slim.cmake`; `CMakeLists.txt` only includes it.

## Optional features

| CMake option                | Default | Effect                                       | Approx savings |
|-----------------------------|---------|----------------------------------------------|----------------|
| `BUILD_WITH_TLS=OFF`        | ON      | Remove TLS (HTTPS/WSS/TLSSocket)             | ~0.3–0.5 MB    |
| `BUILD_WITH_FFI=OFF`        | ON      | Remove libffi and the `tjs:ffi` module       | ~50 KB         |
| `BUILD_WITH_BUNDLED_CA=OFF` | ON      | Drop the embedded Mozilla CA bundle          | ~105 KB        |
| `BUILD_WITH_WEBCRYPTO=OFF`  | ON      | Remove `crypto.subtle`                       | ~165 KB        |
| `BUILD_WITH_MIMALLOC=OFF`   | ON      | Use the system allocator instead of mimalloc | varies         |
| `BUILD_WITH_REPL=OFF`       | ON      | Remove the interactive REPL                  | ~16.6 KB       |
| `BUILD_WITH_WASM_FULL=OFF`  | ON      | WAMR classic interpreter, no SIMD            | ~65 KB         |

When TLS is disabled, plain HTTP/WS and TCP/UDP still work, but `https://` / `wss://` requests
and `TLSSocket`/`TLSServerSocket` throw "TLS not supported in this build"; the Web Crypto API
(`crypto.subtle`) is unaffected since it links `libmbedcrypto` independently.

`BUILD_WITH_BUNDLED_CA=OFF` applies to TLS builds only and removes the embedded Mozilla CA
bundle. Certificate verification then requires an explicit bundle via the `TJS_CA_BUNDLE`
environment variable or `tjs.setCABundlePath()`; without one, HTTPS/WSS and `TLSSocket` fail
verification with a clear error rather than silently trusting anything. Note this does **not**
fall back to the operating system trust store: libwebsockets implements
`LWS_SSL_CLIENT_USE_OS_CA_CERTS` only for its OpenSSL and SChannel backends, and txiki.js
always builds it against mbedTLS.

`BUILD_WITH_WEBCRYPTO=OFF` removes `crypto.subtle`. This **breaks WinterTC compliance** and is
intended for size-constrained embedded profiles only; `crypto.getRandomValues()` and
`crypto.randomUUID()` keep working. It also breaks `tjs app pack` and `tjs app compile`, which
hash the package with `crypto.subtle.digest()`.

`BUILD_WITH_REPL=OFF` removes the interactive REPL. It is the only CLI subcommand with a C
dimension, so unlike the others it needs **both** halves set together:

```bash
make js RUN_MAIN_DEFINES="--define:__TJS_REPL__=false --define:__TJS_EVAL__=true \
  --define:__TJS_SERVE__=true --define:__TJS_BUNDLER__=true --define:__TJS_TEST_RUNNER__=true \
  --define:__TJS_COMPILE__=true --define:__TJS_APP__=true --define:__TJS_HELP__=true \
  --define:__TJS_TLS_CA__=true"
BUILD_WITH_REPL=OFF make
```

The CMake option alone leaves JS calling a binding that no longer exists; the define alone leaves
~14 KB of unreachable bytecode linked in. On such a build, running `tjs` with no arguments from a
terminal reports that the build has no REPL; piping a program to stdin still works, and so does
every other entry point.

`BUILD_WITH_WASM_FULL=OFF` keeps WebAssembly but tunes WAMR for size: the classic interpreter
instead of the fast one, and no SIMD. WebAssembly stays functional — the whole test suite passes
on such a build — but WASM execution is slower and `v128` is unavailable. It only has an effect
when `BUILD_WITH_WASM` is on.

It deliberately leaves `WAMR_BUILD_MULTI_MODULE` alone, even though that is another sizeable
WAMR feature. With multi-module off, `WebAssembly.Memory.prototype.grow()` and
`WebAssembly.Table.prototype.grow()` stop working — growing throws, or returns `-1` — which is
core spec behaviour rather than an optional capability.

The active set of feature flags is exposed to JS via `tjs.engine.features`: `wasm`, `sqlite`,
`tls`, `bundledCa`, `webcrypto` and `ffi`. The REPL reports through `tjs.engine.cli.repl`
instead, alongside the other CLI gates. `BUILD_WITH_WASM_FULL` is not reported at runtime: it
changes how fast WebAssembly runs, not whether `tjs:wasi` and the `WebAssembly` global exist.

Unix/macOS example:

```bash
BUILD_WITH_TLS=OFF make
```

Direct CMake example (the flags can be combined with upstream's `BUILD_WITH_WASM` /
`BUILD_WITH_SQLITE`):

```bash
cmake -B build-slim -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_WITH_WASM=OFF -DBUILD_WITH_SQLITE=OFF -DBUILD_WITH_TLS=OFF
cmake --build build-slim
```

## Size-optimized builds

These remove no feature; they change codegen and linking only, and are independent of one
another.

| CMake option                        | Default | Effect                                                                        |
|-------------------------------------|---------|-------------------------------------------------------------------------------|
| `BUILD_WITH_OZ=ON`                  | OFF     | Use Clang's `-Oz` (more aggressive than `-Os`) in MinSizeRel builds           |
| `BUILD_WITH_NO_OUTLINE=ON`          | OFF     | Disable Clang's AArch64 machine outliner (bigger, much faster at `-Oz`)       |
| `BUILD_WITH_QJS_SPEED=ON`           | OFF     | Compile `deps/quickjs` at `-Os` while the rest of the binary stays at `-Oz`   |
| `BUILD_WITH_HIDDEN_VISIBILITY=ON`   | OFF     | Compile with `-fvisibility=hidden` so the linker/LTO can prune more           |
| `BUILD_WITH_ICF=ON`                 | OFF     | Identical-code folding at link (lld/gold; ELF only)                           |
| `BUILD_WITH_COMPRESSED_BYTECODE=ON` | OFF     | Deflate the embedded JS bytecode, inflated lazily at load                     |
| `BUILD_WITH_REPRODUCIBLE_PATHS=ON`  | OFF     | Remap `__FILE__`/debug paths so absolute source paths are not embedded        |
| `BUILD_WITH_HARDENING=ON`           | OFF     | Exploit-mitigation flags (stack protector, zero-init, FORTIFY, arm64 PAC/BTI) |

Notes:

- `BUILD_WITH_OZ` requires Clang and only affects `MinSizeRel` (it rewrites `-Os` to `-Oz` in the
  MinSizeRel flags). Under GCC it warns and keeps `-Os`. `-Oz` can slow hot paths.
- `BUILD_WITH_HIDDEN_VISIBILITY` hides non-exported symbols (`-fvisibility-inlines-hidden` is added
  for C++). FFI `dlopen` and SQLite loadable extensions are unaffected (loaded modules are
  self-contained).
- `BUILD_WITH_ICF` needs lld or gold and folds at `--icf=safe`. It is skipped on Apple ld64 (which
  has no `--icf`, but already gets `-Wl,-dead_strip` from `BUILD_WITH_GC_SECTIONS`) and on MSVC
  (which folds via `/OPT:ICF`).
- `BUILD_WITH_COMPRESSED_BYTECODE` **must** be paired with `tjsc -z` when generating the bundles
  (`make js TJSC_COMPRESS=-z`). The two settings encode and decode the same format, so enabling
  one without the other makes the loader inflate garbage.
- `BUILD_WITH_HIDDEN_VISIBILITY`, `BUILD_WITH_REPRODUCIBLE_PATHS`, `BUILD_WITH_HARDENING` and
  `BUILD_WITH_NO_UNWIND_TABLES` are all skipped on MSVC, where the underlying compiler flags do
  not exist. A Windows/MSVC build is therefore neither hardened nor as small as a Clang/GCC one.
- `BUILD_WITH_QJS_SPEED` only means something on top of `BUILD_WITH_OZ`: it exists to undo `-Oz`
  for one target, and under GCC (which never gets `-Oz`) it re-applies the `-Os` that is already
  there. It also makes `BUILD_WITH_NO_OUTLINE` redundant rather than additive — see below.

### Tuned distribution build

`BUILD_WITH_NO_OUTLINE=ON` keeps `-Oz` and LTO but switches off Clang's AArch64 machine outliner,
which is on by default at `-Oz`. The outliner pulls repeated instruction sequences out of
QuickJS's interpreter dispatch loop — measured on macOS arm64 that is worth 4.1% of the binary and
27% of the run time, which is the worst trade in the whole size ladder.

It is the cheaper half of what `--optimization balanced` does. If size is not that tight, prefer
`balanced`: for another 2.6% it gets the full 41%.

It takes two flags, and the compile-time one alone does nothing under LTO: `-flto=thin` defers
codegen to the link, long after `-mno-outline` was parsed. The option sets both, probing the
compiler and linker first, so it degrades to a warning on GCC (no outliner) and MSVC.

```bash
node scripts/build-dist.mjs --profile min --optimization tuned \
  --build-dir build-dist-tuned-min --out dist/tuned-min
```

### Balanced distribution build

Published `balanced-min` binaries are `min` with `BUILD_WITH_QJS_SPEED=ON`: `-Oz` + LTO for the
binary as a whole, with the `qjs` target — QuickJS, and so ~all JS execution time — raised back to
`-Os`. Everything else (libuv, libwebsockets, mbedTLS, ada) is cold once the runtime is up and
stays at `-Oz`. Measured on macOS arm64 that is **+6.7% size for -41% run time**, against +10.8%
for the whole binary at `-Os`.

`-Os` and `-Oz` are recorded per function in the IR as the `optsize`/`minsize` attributes, so
unlike `-mno-outline` this survives LTO. It also subsumes `--optimization tuned`: the machine
outliner only runs on `minsize` functions, and `-Os` does not mark them.

```bash
node scripts/build-dist.mjs --profile min --optimization balanced \
  --build-dir build-dist-balanced-min --out dist/balanced-min
```

:::warning[Experimental]
`BUILD_WITH_NO_UNWIND_TABLES=ON` drops the async unwind / `.eh_frame` tables used for crash and
signal backtraces. C++ exception unwinding still works, but crash backtraces will be unusable.
It is off by default in CMake; verify your signal/error paths before enabling it.

Note the **published binaries do turn it on** — `scripts/build-dist.mjs` passes it for every
non-MSVC profile. So a downloaded Linux or macOS `tjs` has unusable crash backtraces by
design. Build from source with it off if you need them.
:::
