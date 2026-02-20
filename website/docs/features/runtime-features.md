---
sidebar_position: 2
title: Runtime Features
---

# Runtime Features

txiki.js provides support for the [ES2025](https://tc39.es/ecma262/) specification (almost complete), along with a number of runtime features.

## Core features

- [TCP](/docs/api/global.Class.TCPSocket) and [UDP](/docs/api/global.Class.UDPSocket) sockets
- [Unix sockets / named pipes](/docs/api/global.Class.PipeSocket)
- [Signal handling](/docs/api/global.tjs.Function.addSignalListener)
- [File operations](/docs/api/global.tjs.Function.open)
- [Child processes](/docs/api/global.tjs.Function.spawn)
- [DNS](/docs/api/global.tjs.Function.lookup) (getaddrinfo)
- [HTTP Server](/docs/api/global.tjs.Function.serve)
- [WASI](/docs/api/tjs-wasi)
- [Standalone executables](../guides/standalone-executables.md)

## Extras

- Import directly from HTTP(S) URLs
- Import JSON files
- Builtin test runner

See the [API Reference](/docs/api-reference) for detailed documentation.
