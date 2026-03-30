---
sidebar_position: 5
title: Modules
---

# Modules

txiki.js uses standard ES modules. Every `.js` file is treated as a module, and you can import from local files, HTTP URLs, the standard library, and more.

## Local imports

Relative and absolute paths work as expected:

```javascript
import { helper } from './lib/utils.js';
import config from '../config.js';
```

File extensions are always required — there is no automatic `.js` resolution or `index.js` lookup.

## Standard library (`tjs:`)

Built-in modules are imported with the `tjs:` prefix:

```javascript
import assert from 'tjs:assert';
import path from 'tjs:path';
import { Database } from 'tjs:sqlite';
```

See the [Standard Library](../features/standard-library.md) for the full list.

## HTTP imports

You can import modules directly from HTTP and HTTPS URLs:

```javascript
import { render } from 'https://esm.sh/preact';
import data from 'https://example.com/api/config.js';
```

The module is fetched synchronously during module resolution. The URL is used as the module identifier for caching — the same URL won't be fetched twice.

## Import attributes

Import attributes let you import non-JavaScript files as modules. The `type` attribute controls how the file is interpreted.

### JSON

```javascript
import data from './data.json' with { type: 'json' };
// data is the parsed JSON object

import pkg from './package.json' with { type: 'json' };
console.log(pkg.version);
```

Files ending in `.json` are automatically treated as JSON even without the attribute.

### Text

```javascript
import template from './template.html' with { type: 'text' };
// template is a string containing the file contents

import query from './query.sql' with { type: 'text' };
```

### Bytes

```javascript
import wasm from './module.wasm' with { type: 'bytes' };
// wasm is a Uint8Array containing the raw file bytes

import cert from './cert.pem' with { type: 'bytes' };
```

All three types expose their value as the `default` export.

## Import maps

[Import maps](https://github.com/WICG/import-maps) let you map bare specifiers (like `"lodash"`) to file paths or URLs. Without an import map, bare specifiers fail because they don't resolve to a file path.

### CLI flag

```bash
tjs run --import-map import-map.json app.js
```

### TPK app packages

For [TPK app packages](app-packages.md), add `imports` and `scopes` directly to `app.json`:

```json
{
    "version": 0,
    "build": {},
    "main": "src/main.js",
    "imports": {
        "utils": "./src/lib/utils.js"
    }
}
```

### Format

An import map is a JSON object with two optional fields: `imports` and `scopes`. Paths are resolved relative to the import map file (or `app.json` for TPK apps).

#### Basic mappings

```json
{
    "imports": {
        "lodash": "./vendor/lodash/index.js",
        "api": "https://cdn.example.com/api.js"
    }
}
```

```javascript
import _ from 'lodash';      // → ./vendor/lodash/index.js
import api from 'api';       // → https://cdn.example.com/api.js
```

#### Prefix mappings

Keys ending with `/` act as path prefixes:

```json
{
    "imports": {
        "lodash/": "./vendor/lodash/"
    }
}
```

```javascript
import { merge } from 'lodash/merge.js';  // → ./vendor/lodash/merge.js
```

#### Scoped mappings

Override mappings for specific directories:

```json
{
    "imports": {
        "pkg": "./vendor/pkg-v2/index.js"
    },
    "scopes": {
        "./legacy/": {
            "pkg": "./vendor/pkg-v1/index.js"
        }
    }
}
```

Files inside `./legacy/` resolve `pkg` to v1, while everything else gets v2. The most specific scope (longest prefix match) wins.

### Notes

- Only one import map can be active at a time.
- The import map must be set before any modules are loaded.
- `tjs:*` built-in modules are not affected by import maps unless explicitly mapped.
- Unmatched specifiers fall through to default resolution.
