# API Reference

txiki.js provides a comprehensive set of APIs for building applications. The global `tjs` namespace contains core functionality, while additional features are available as importable standard library modules.

## Global APIs

The `tjs` global object provides the following groups of APIs:

- **Filesystem** — File I/O, directory operations, path manipulation, and file watching.
- **Networking** — TCP, UDP, and Unix pipe sockets for building network applications.
- **HTTP Server** — High-performance HTTP server with WebSocket support via `tjs.serve()`.
- **Process** — Spawn child processes, handle signals, and manage the current process.
- **System** — Environment variables, OS information, and runtime metadata.
- **Engine** — Low-level access to the JavaScript engine: bytecode compilation, serialization, and garbage collection.
- **Utilities** — Console helpers and interactive prompts.

## Standard Library

Additional functionality is available as ES modules that can be imported using the `tjs:` scheme:

| Module | Description |
|--------|-------------|
| [`tjs:assert`](api/tjs-assert.md) | Assertion functions for testing |
| [`tjs:ffi`](api/tjs-ffi.md) | Foreign Function Interface for calling native libraries |
| [`tjs:getopts`](api/tjs-getopts.md) | Command-line argument parsing |
| [`tjs:hashing`](api/tjs-hashing.md) | Cryptographic hash functions |
| [`tjs:ipaddr`](api/tjs-ipaddr.md) | IP address parsing and manipulation |
| [`tjs:path`](api/tjs-path.md) | File path utilities (POSIX and Windows) |
| [`tjs:posix-socket`](api/tjs-posix-socket.md) | Low-level POSIX socket API |
| [`tjs:readline`](api/tjs-readline.md) | Interactive line editing and ANSI colors |
| [`tjs:sqlite`](api/tjs-sqlite.md) | SQLite3 database |
| [`tjs:utils`](api/tjs-utils.md) | Utility functions for formatting and inspecting values |
| [`tjs:uuid`](api/tjs-uuid.md) | UUID generation and validation |
| [`tjs:wasi`](api/tjs-wasi.md) | WebAssembly System Interface |

In addition, txiki.js supports many [Web Platform APIs](/docs/features/web-platform-apis) such as `fetch`, `WebSocket`, `setTimeout`, `TextEncoder`, and more.
