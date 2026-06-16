---
sidebar_position: 2
title: Runtime Features
---

# Runtime Features

txiki.js provides support for the [ES2025](https://tc39.es/ecma262/) specification (almost complete), along with a number of runtime features.

## Modules

txiki.js uses standard [ES modules](../guides/modules.md) with support for HTTP imports, import attributes (JSON, text, bytes), and import maps.

## Core features

- [TCP, TLS, UDP and Unix sockets](../guides/networking.md)
- [Signal handling](../guides/child-processes.md#process-wide-signal-handling) and [child processes](../guides/child-processes.md)
- [File operations](../guides/filesystem.md)
- [DNS](/docs/api/global.tjs.Function.lookup) (getaddrinfo)
- [HTTP server](../guides/serve.md)
- [WASI](/docs/api/tjs-wasi)
- [Standalone executables](../guides/standalone-executables.md)
- [Builtin test runner](../cli.md#tjs-test)

See the [CLI Reference](../cli.md) for the command-line interface, and the [API Reference](/docs/api-reference) for detailed API documentation.
