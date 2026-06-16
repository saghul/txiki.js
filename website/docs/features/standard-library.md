---
sidebar_position: 3
title: Standard Library
---

# Standard Library

txiki.js ships a small standard library of modules that build on the core runtime. They are imported using the `tjs:` scheme:

```js
import assert from 'tjs:assert';
import { parse } from 'tjs:path';
import { Database } from 'tjs:sqlite';

assert.eq(1 + 1, 2);
```

## Modules

| Module | Description |
|--------|-------------|
| [`tjs:assert`](/docs/api/tjs-assert) | Assertion functions for testing |
| [`tjs:ffi`](/docs/api/tjs-ffi) | Foreign Function Interface for calling native libraries |
| [`tjs:getopts`](/docs/api/tjs-getopts) | Command-line argument parsing |
| [`tjs:hashing`](/docs/api/tjs-hashing) | Cryptographic hash functions ([guide](../guides/hashing.md)) |
| [`tjs:ipaddr`](/docs/api/tjs-ipaddr) | IP address parsing and manipulation |
| [`tjs:path`](/docs/api/tjs-path) | File path utilities (POSIX and Windows) |
| [`tjs:posix-socket`](/docs/api/tjs-posix-socket) | Low-level POSIX socket API |
| [`tjs:readline`](/docs/api/tjs-readline) | Interactive line editing and ANSI colors |
| [`tjs:sqlite`](/docs/api/tjs-sqlite) | SQLite3 database |
| [`tjs:utils`](/docs/api/tjs-utils) | Utility functions for formatting and inspecting values |
| [`tjs:uuid`](/docs/api/tjs-uuid) | UUID generation and validation |
| [`tjs:wasi`](/docs/api/tjs-wasi) | WebAssembly System Interface |

See the [API Reference](/docs/api-reference#standard-library) for the full per-symbol documentation.

## Build-time feature gating

A couple of modules depend on optional build features and may be absent from a custom build:

- `tjs:sqlite` requires `BUILD_WITH_SQLITE` (on by default). When disabled, importing it throws and `localStorage` falls back to an in-memory store.
- `tjs:wasi` (and the `WebAssembly` global) requires `BUILD_WITH_WASM` (on by default). When disabled, importing it throws a module-not-found error.

Detect availability at runtime via [`tjs.engine.features`](/docs/api/global.tjs.Namespace.engine):

```js
if (tjs.engine.features.sqlite) {
    const { Database } = await import('tjs:sqlite');
    // ...
}
```
