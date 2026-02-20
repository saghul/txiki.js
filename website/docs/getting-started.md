---
sidebar_position: 1
title: Getting Started
---

# Getting Started

> **txikia** (Basque): small, tiny.

**txiki.js** is a small and powerful JavaScript runtime. It targets state-of-the-art ECMAScript and aims to be [WinterTC](https://wintertc.org/) compliant.

It's built on the shoulders of giants: it uses [QuickJS-ng](https://github.com/quickjs-ng/quickjs) as its JavaScript engine and [libuv](https://libuv.org/) as the platform layer.

## Installation

Prebuilt binaries are available for macOS and Windows from the [GitHub Releases](https://github.com/saghul/txiki.js/releases) page:

| Platform | Architecture |
|----------|-------------|
| macOS | arm64, x86_64 |
| Windows | x86_64 |

Download the zip for your platform, extract it, and add the `tjs` binary to your `PATH`.

On Linux (and other Unixes), you'll need to [build from source](building.md).

## Quick start

Try it out:

```bash
./build/tjs eval "console.log('hello world')"
```

Run a script with `tjs run`:

```bash
./build/tjs run examples/hello_world.js
```

Explore all the options:

```bash
./build/tjs --help
```

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
