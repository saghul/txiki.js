---
sidebar_position: 2
title: Downloads
---

import ForkNotice from '@site/src/components/ForkNotice';

# Download a released binary

<ForkNotice />

This fork publishes prebuilt slim binaries on every release: **8 profiles × 4 platforms**,
attached to a `slim-vX.Y.Z-N` tag on the
[Releases page](https://github.com/lukasMega/txiki.js-with-slim-builds/releases).

The tag says which upstream release the build contains. `slim-v26.6.0-8` is the eighth slim
build of upstream `v26.6.0`; the trailing number increments when the fork re-publishes the
same upstream version.

## Pick a profile

Every profile is a size/feature trade. Start from the smallest one that has what you need —
the difference between `min` and `ffi-tls-sqlite` is roughly **1.7×** in bytes.

| profile | FFI | TLS | SQLite | for |
| --- | :---: | :---: | :---: | --- |
| `min` | — | — | — | scripting, embedding, anything that doesn't touch the network or a database |
| `ffi` | ✅ | — | — | calling into a native library via `tjs:ffi` |
| `tls` | — | ✅ | — | `https://` / `wss://` fetch and WebSocket, `TLSSocket` |
| `sqlite` | — | — | ✅ | `tjs:sqlite`, and a `localStorage` that persists |
| `ffi-tls` | ✅ | ✅ | — | the common "talks to the internet and to C" case |
| `ffi-tls-sqlite` | ✅ | ✅ | ✅ | the largest published profile |
| `tuned-min` | — | — | — | `min`, compiled for speed over size (see below) |
| `balanced-min` | — | — | — | `min`, with the JS engine compiled for speed (see below) |

`tuned-min` and `balanced-min` are **not extra features** — they are the exact feature set of
`min` at a different codegen setting. See [Size and speed](./size-and-speed.md) for what that
buys and costs.

### What every profile has

Identical across all eight, so it is never the thing that decides your choice:

- **Web Crypto is on** (`crypto.subtle`, `crypto.getRandomValues`, `crypto.randomUUID`).
- **The REPL is on** — run the binary with no arguments.
- **`tjs compile` is on**, so you can build standalone executables.

### What no profile has

- **WebAssembly is off in every published build**, including `ffi-tls-sqlite`. There is no
  `WebAssembly` global and no `tjs:wasi` module. Dropping WAMR is most of what makes these
  binaries small; if you need Wasm, [build from source](./building.md) with the default
  `BUILD_WITH_WASM=ON`.
- Several CLI subcommands are compiled out: **`tjs eval`, `tjs serve`, `tjs bundle`,
  `tjs test`, `tjs app` and `tjs help` are absent.** `tjs run` and the REPL are not. If you
  want to run the test suite against one of these binaries, see
  [Testing a slim build](./testing-slim-builds.md).

You never have to guess which of these applies to a binary you already have — ask it. Note
that `tjs eval` is one of the compiled-out subcommands, so the one-liner goes through stdin:
a binary given a script on stdin runs it, in every profile. (`-e` is still *accepted* by the
argument parser but never read, so it silently does nothing rather than erroring.)

```console
$ echo 'console.log(tjs.engine.features, tjs.engine.cli)' | ./tjs
```

## Install

Assets are named `txiki-slim-{profile}-{platform}.zip`, where `{platform}` is one of
`linux-x86_64`, `linux-arm64`, `macos-arm64` or `windows-x86_64`.

```bash
# Linux / macOS -- pick your profile and platform
VERSION=slim-v26.6.0-8
ASSET=txiki-slim-min-linux-x86_64.zip

curl -fsSLO "https://github.com/lukasMega/txiki.js-with-slim-builds/releases/download/$VERSION/$ASSET"
unzip "$ASSET"

# Each zip unpacks into a directory of its own name, holding tjs, BUILDINFO.txt
# and SHA256SUMS -- there is no bare binary at the top level.
cd "${ASSET%.zip}"
chmod +x tjs
echo 'console.log(tjs.version)' | ./tjs
```

```powershell
# Windows
$Version = 'slim-v26.6.0-8'
$Asset   = 'txiki-slim-min-windows-x86_64.zip'

Invoke-WebRequest -Uri "https://github.com/lukasMega/txiki.js-with-slim-builds/releases/download/$Version/$Asset" -OutFile $Asset
Expand-Archive $Asset -DestinationPath .

# The zip unpacks into a directory of its own name.
Set-Location ($Asset -replace '\.zip$','')
'console.log(tjs.version)' | .\tjs.exe
```

The zips are produced with Info-ZIP so the Unix executable bit survives; `chmod +x` above is
belt-and-braces for archives unpacked by other tools.

### Verify the download

Each release carries a single combined `SHA256SUMS.txt` covering every asset. Its entries are
`<profile-platform>/tjs`, matching the directory the zip unpacks into, so run it from the
**parent** of that directory — not from inside it:

```bash
cd ..    # if you followed the install steps above
curl -fsSLO "https://github.com/lukasMega/txiki.js-with-slim-builds/releases/download/$VERSION/SHA256SUMS.txt"
sha256sum --check --ignore-missing SHA256SUMS.txt
```

`--ignore-missing` is what lets one combined file verify the one profile you actually
downloaded rather than failing on the other 31.

Every zip also contains a `BUILDINFO.txt` recording the profile, the codegen mode, the
feature vector, the platform, the binary's size in bytes, its SHA-256, and whether it was
built with MSVC.

## The Windows caveat

Windows binaries are built with **MSVC**, where nine of the eleven size and hardening levers
do not exist. Absent there: `-Oz`, the machine-outliner switch, the per-target QuickJS
optimisation level, hidden symbol visibility, identical-code folding, symbol stripping,
dropped unwind tables, reproducible paths, and the hardening set (stack protector,
zero-init, FORTIFY). Only LTO and dead-code section stripping survive.

Two consequences worth knowing:

1. **The Windows artifact is a deliberately different, non-hardened profile.** It is named
   without the `-hardened` suffix its Unix counterparts carry in `BUILDINFO.txt`, so the
   difference is recorded in the artifact rather than only in this page.
2. **Windows binaries are larger** than the Linux and macOS ones for the same profile, by
   roughly 10–27% depending on profile. That is the missing `-Oz` and strip, not extra
   functionality.

Something similar happens on Linux for a different reason: the Linux jobs use the runner's
GCC, which has no `-Oz` either. The practical result, verified against the `SHA256SUMS.txt`
of `slim-v26.6.0-8`:

- **`tuned-min` is byte-identical to `min` on Linux** (same SHA-256 on both `x86_64` and
  `arm64`). Its only effect is disabling Clang's machine outliner, and GCC has none. On
  Windows the two binaries are the same size but hash differently — a PE header embeds a
  build timestamp, so MSVC output is never reproducible and hashes there prove nothing.
- **`balanced-min` differs in `slim-v26.6.0-8`**, but only because that release predates the
  recipe change described below: it was built `-Os` whole-binary with LTO *off*, so on GCC it
  differs from `min` by the LTO delta. Under the current recipe it collapses onto `min` on
  Linux and Windows too, since raising the engine to `-Os` is a no-op where the whole build
  is already `-Os`.

**On Linux and Windows, all three `min` variants end up as the same binary.** macOS arm64 is
the only platform where the choice is real.

## Sizes

Compressed asset sizes from **`slim-v26.6.0-8`** (commit `1274e5e7`, published
2026-08-24). They move between releases; the release page is always current.

| profile | linux-x86_64 | linux-arm64 | macos-arm64 | windows-x86_64 |
| --- | ---: | ---: | ---: | ---: |
| `min` | 1.03 MB | 1.10 MB | 1.07 MB | 1.31 MB |
| `tuned-min` | 1.03 MB | 1.10 MB | 1.05 MB | 1.31 MB |
| `balanced-min` | 1.03 MB | 1.12 MB | 1.11 MB | 1.32 MB |
| `ffi` | 1.06 MB | 1.13 MB | 1.10 MB | 1.35 MB |
| `tls` | 1.31 MB | 1.40 MB | 1.36 MB | 1.62 MB |
| `sqlite` | 1.49 MB | 1.62 MB | 1.57 MB | 1.79 MB |
| `ffi-tls` | 1.34 MB | 1.43 MB | 1.39 MB | 1.66 MB |
| `ffi-tls-sqlite` | 1.80 MB | 1.95 MB | 1.90 MB | 2.14 MB |

These are **zip sizes**, not binary sizes — the unpacked `tjs` is roughly twice as large.
For unpacked, per-segment measurements see [Size and speed](./size-and-speed.md).

:::note

`balanced-min` was re-specified after `slim-v26.6.0-8` was cut — it used to rebuild the
whole binary at `-Os` with LTO off, and now raises only the JS engine while keeping LTO. Its
row above is the old recipe. The next release will be smaller at the same speed; the
[Size and speed](./size-and-speed.md) page has both sets of numbers.

:::

## Build one yourself instead

Nothing here is special: the published profiles are ordinary combinations of the options in
[Slim builds](./slim-builds.md), driven by `scripts/build-dist.mjs`. If none of the eight is
the trade you want — say, TLS without the bundled CA bundle, or a build that keeps
WebAssembly — build it from source.
