---
sidebar_position: 4
title: Testing a slim build
---

import ForkNotice from '@site/src/components/ForkNotice';

# Testing a slim build

<ForkNotice />

The published profiles have the test runner compiled out, so
`./tjs test tests/` on a downloaded binary fails — there is no `test` subcommand. That is
deliberate, and it does **not** mean the artifact is untested: every profile is run through
the entire suite in CI before it is published.

This page is for when you want to reproduce that yourself, or when you build a custom
feature set and need to know it still works.

## The split: `tjs run` is kept, `tjs test` is not

The test runner is a CLI subcommand that walks a directory and spawns a child process per
test file. What actually *executes* a test file is `tjs run`, and `tjs run` is present in
every profile.

So the two halves can come from different binaries. Set **`TJS_TEST_EXE`** to the binary
under test and drive the loop with a full-CLI build:

```bash
# ./build/tjs is a normal `make` build; dist/min/tjs is the artifact being tested
TJS_TEST_EXE=$(pwd)/dist/min/tjs ./build/tjs test tests/
```

Every test file runs inside `TJS_TEST_EXE`. The driver only walks directories, spawns and
tallies.

If you use `mise`, the same thing is a task:

```bash
mise run test:dist min      # one profile
mise run test:dist:all      # all eight published profiles
```

## Tests are skipped based on the binary under test

A `min` binary has no TLS, so `test-tls-*.js` cannot pass. `tests/feature-skip.json` maps
each feature to the test files that need it:

```json
{
  "tls": [ "test-tls-*.js", "test-fetch-h2-*.js", "..." ],
  "sqlite": [ "test-sqlite.js", "test-storage.js", "..." ],
  "cli.bundler": [ "test-bundle-*.js" ]
}
```

Two kinds of key:

- **Plain keys** (`wasm`, `sqlite`, `tls`, `bundledCa`, `webcrypto`, `ffi`) are build
  features, read from `tjs.engine.features`.
- **`cli.`-prefixed keys** (`cli.repl`, `cli.eval`, `cli.serve`, `cli.bundler`,
  `cli.testRunner`, `cli.compile`, `cli.app`, `cli.help`, `cli.tlsCa`) are CLI subcommands,
  read from `tjs.engine.cli`.

Only `*` wildcards at a single position are supported — no `**`, no `?`.

The important part: the runner probes **`TJS_TEST_EXE`** for its own `tjs.engine.features`
and `tjs.engine.cli` before the loop starts, not the host binary. Tests are gated on the
binary being tested. A probe that cannot run, prints nothing, or reports fewer keys than the
host is a **hard error**, never a silent pass — a skip filter that quietly matches nothing
would turn the whole suite green.

:::warning

Read the SKIP count, not just the FAIL count. A profile can go green by skipping too much.

:::

## Tests that need a native fixture

A few tests `dlopen` a fixture library built next to `tjs` (`libffi-test`,
`libsqlite-test`). They are looked up under `./build` by default. When your driver lives
elsewhere, set **`TJS_TEST_LIBDIR`** — without it those tests **fail loudly** rather than
skipping:

```bash
TJS_TEST_EXE=$(pwd)/dist/min/tjs \
TJS_TEST_LIBDIR=$(pwd)/build-host \
  ./build-host/tjs test tests/
```

`scripts/build-dist.mjs --host-tjs` builds a driver plus those fixtures into `--host-dir`
(default `build-host`) as part of a dist build, which is how CI gets one.

:::danger

Never point `--host-dir` at your normal `./build`. It configures a feature-reduced tree, and
`make` only passes `BUILDTYPE` and `MIMALLOC`, so the cached CMake options would silently
survive into your next ordinary build.

:::

## Three tests that need no gating at all

Most tests assert a fixed expectation. Three assert against the binary's **own** feature
vector instead, so they are meaningful on every profile and appear in no skip list:

| test | asserts |
| --- | --- |
| `test-cli-gating.js` | a subcommand is reachable **iff** `tjs.engine.cli` says it is |
| `test-builtin-module-gating.js` | a `tjs:` module is importable **iff** its feature is on |
| `test-test-exe-override.js` | the suite really is running inside `TJS_TEST_EXE` |

The first two are what catch a build option that flipped without its JS-side gating, in
either direction — a feature claimed but missing, or present but not advertised.

## What CI runs

Two workflows gate the slim builds, and both run the *shipped* binary through the whole
suite rather than testing a stand-in:

- **`verify.yml`** — every push and pull request, Linux only, the six feature profiles. The
  fast per-merge signal.
- **`dist.yml`** — eight profiles across Linux x64, Linux arm64, macOS arm64 and Windows.
  The release job depends on the build job, so **a profile whose suite fails is never
  published.**

The feature vector of each artifact is also asserted inside `build-dist.mjs` itself, so a
silently flipped CMake default fails at build time instead of surfacing later as a confusing
test failure.

See [Fork and CI internals](./fork-and-ci.md) for the rest of the pipeline.
