---
sidebar_position: 3
title: Standard Library
---

# Standard Library

txiki.js includes a standard library with modules for assertions, FFI, path utilities, SQLite, UUID generation, and more. See the [API Reference](/docs/api-reference#standard-library) for the full list.

Import them using the `tjs:` prefix:

```js
import { test } from 'tjs:assert';
import { parse } from 'tjs:path';
import { Database } from 'tjs:sqlite';
```
