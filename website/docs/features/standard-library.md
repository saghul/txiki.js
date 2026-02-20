---
sidebar_position: 3
title: Standard Library
---

# Standard Library

txiki.js includes a standard library with the following modules:

| Module | Description |
|--------|-------------|
| [`tjs:assert`](/docs/api/tjs-assert) | Assertion utilities |
| [`tjs:ffi`](/docs/api/tjs-ffi) | Foreign function interface |
| [`tjs:getopts`](/docs/api/tjs-getopts) | Command-line option parsing |
| [`tjs:hashing`](/docs/api/tjs-hashing) | Hashing functions |
| [`tjs:ipaddr`](/docs/api/tjs-ipaddr) | IP address manipulation |
| [`tjs:path`](/docs/api/tjs-path) | Path utilities |
| [`tjs:posix-socket`](/docs/api/tjs-posix-socket) | Low-level POSIX socket API |
| [`tjs:sqlite`](/docs/api/tjs-sqlite) | SQLite database interface |
| [`tjs:uuid`](/docs/api/tjs-uuid) | UUID generation |
| [`tjs:wasi`](/docs/api/tjs-wasi) | WebAssembly System Interface |

See the [API Reference](/docs/api-reference) for detailed documentation on each module.

Import them using the `tjs:` prefix:

```js
import { test } from 'tjs:assert';
import { parse } from 'tjs:path';
import { Database } from 'tjs:sqlite';
```
