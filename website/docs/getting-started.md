---
sidebar_position: 1
title: Getting Started
---

# Getting Started

> **txikia** (Basque): small, tiny.

**txiki.js** is a small and powerful JavaScript runtime. It targets state-of-the-art ECMAScript and aims to be [WinterTC](https://wintertc.org/) compliant.

It's built on the shoulders of giants: it uses [QuickJS-ng](https://github.com/quickjs-ng/quickjs) as its JavaScript engine and [libuv](https://libuv.org/) as the platform layer.

## Installation

### [Homebrew](https://brew.sh/) (macOS and Linux)

```bash
brew install saghul/tap/txikijs
```

### [WinGet](https://learn.microsoft.com/windows/package-manager/) (Windows)

```powershell
winget install Saghul.TxikiJS
```

### [Scoop](https://scoop.sh/) (Windows)

```powershell
scoop install txikijs
```

### Prebuilt binaries

Prebuilt binaries are available for macOS and Windows from the [GitHub Releases](https://github.com/saghul/txiki.js/releases) page:

| Platform | Architecture |
|----------|-------------|
| macOS | arm64, x86_64 |
| Windows | x86_64 |

Download the zip for your platform, extract it, and add the `tjs` binary to your `PATH`.

### [mise](https://mise.jdx.dev/) (per-project)

Pin a txiki.js version per project and run it without a system-wide install:

```bash
mise use "github:saghul/txiki.js[exe=tjs]"
```

See [Using with mise](guides/mise.md) for details.

### Build from source

On Linux (and other Unixes), you'll need to [build from source](building.md).

## Quick start

Once `tjs` is on your `PATH`, try evaluating an expression:

```bash
tjs eval "console.log('hello world')"
```

Run a script with `tjs run`:

```bash
echo "console.log('hello from a file')" > hello.js
tjs run hello.js
```

Or start the interactive REPL by running `tjs` with no arguments:

```bash
tjs
```

Explore all the subcommands and options:

```bash
tjs --help
```

See the [CLI Reference](cli.md) for the full list of subcommands, options, and environment variables.

> If you [built from source](building.md) instead of installing a package, invoke the binary as `./build/tjs` and try the bundled scripts, e.g. `./build/tjs run examples/hello_world.js`.

## Supported platforms

- GNU/Linux
- macOS
- Windows
- Other Unixes (please test!)

## What's included

txiki.js comes with a rich set of features out of the box:

- [Web Platform APIs](features/web-platform-apis.md) — `fetch`, `WebSocket`, `Console`, `setTimeout`, `Crypto`, Web Workers, and more
- [Runtime Features](features/runtime-features.md) — TCP/UDP sockets, file I/O, child processes, signal handling, DNS
- [Standard Library](features/standard-library.md) — `tjs:sqlite`, `tjs:ffi`, `tjs:path`, `tjs:hashing`, and more
- [HTTP Server](/docs/api/global.tjs.Function.serve) — high-performance HTTP server with WebSocket support
- [Standalone Executables](guides/standalone-executables.md) — compile your scripts into self-contained binaries

See the [API Reference](/docs/api-reference) for the full documentation.
