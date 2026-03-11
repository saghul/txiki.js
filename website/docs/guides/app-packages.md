---
sidebar_position: 3
title: App Packages (TPK)
---

# App Packages (TPK)

:::warning[Experimental]
The TPK format and `tjs app` commands are experimental. The format, CLI, and behavior may change in future releases.
:::

TPK is a simple packaging format for txiki.js applications. It lets you bundle a multi-file app into a single `.tpk` archive or compile it into a standalone executable — without needing a separate bundling step.

Unlike [`tjs compile`](standalone-executables.md), which embeds a single pre-compiled JavaScript file as bytecode, `tjs app compile` packages your entire source tree (multiple files, ES module imports, assets) as a ZIP archive appended to the runtime binary. The app is extracted to a temporary directory on first run and cached for subsequent launches.

## Quick start

```bash
# Scaffold a new app
tjs app init

# Run it directly during development
tjs run app/src/main.js

# Package as a standalone executable
tjs app compile myapp
./myapp
```

## App structure

A TPK app lives in an `app/` directory:

```
app/
    app.json          # manifest
    src/
        main.js       # entry point
        ...           # other source files
```

### Manifest (`app.json`)

The manifest describes the app and is updated automatically at build time:

```json
{
    "version": 0,
    "build": {},
    "main": "src/main.js"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `version` | Yes | Schema version. Must be `0`. |
| `build` | No | Populated automatically by `pack` / `compile`. |
| `build.id` | — | UUIDv4, regenerated on every build. |
| `build.timestamp` | — | ISO 8601 UTC timestamp of the build. |
| `main` | No | Entry point relative to the app root. Defaults to `src/main.js`. |

## CLI commands

### `tjs app init`

Creates a template app in the current directory:

```bash
tjs app init
```

This generates:

- `app/app.json` — manifest with an empty `build` section
- `app/src/main.js` — hello-world entry point

Errors if the `app/` directory already exists.

### `tjs app pack [outfile]`

Packages the app into a `.tpk` file (a standard ZIP archive):

```bash
tjs app pack              # writes <build-id>.tpk
tjs app pack myapp.tpk    # writes myapp.tpk
```

A fresh `build.id` and `build.timestamp` are generated on every invocation and written into the `app.json` inside the archive.

### `tjs app compile [outfile]`

Compiles the app into a standalone executable:

```bash
tjs app compile              # writes ./app (or app.exe on Windows)
tjs app compile myapp        # writes ./myapp
```

The resulting binary is fully self-contained — it includes the txiki.js runtime and the packaged app. No installation is needed to run it.

## How it works

### Packaging

`tjs app pack` collects every file under `app/`, generates a fresh build ID and timestamp, updates the in-memory manifest, and creates a ZIP archive containing:

```
app.json
src/
    main.js
    ...
```

### Compiling

`tjs app compile` performs the same packaging step and then appends the result to a copy of the `tjs` binary with a trailer:

```
[Original tjs executable]
[Build UUID — 32 bytes, ASCII]
[SHA-256 of ZIP data — 32 bytes]
[ZIP data — N bytes]
[ZIP data size — 8 bytes, little-endian]
[Magic — 4 bytes: "TPK\0"]
```

### Running a compiled executable

On startup, the runtime detects the TPK trailer by reading the last 4 bytes of its own binary. If it finds the `TPK\0` magic, it:

1. Reads the ZIP size, UUID, SHA-256 hash, and ZIP data from the trailer.
2. Verifies the SHA-256 hash to ensure integrity.
3. Checks for a cached extraction in the system temp directory (`{tmpDir}/tjs-{buildId}/`).
4. If no cache exists, extracts the ZIP to a temporary directory and atomically renames it into place. A `.tpk-ok` sentinel file marks a complete extraction.
5. Validates the manifest (`version` and `build.id`).
6. Runs the entry point specified by `main`.

Since the build ID is a fresh UUID on every build, each build gets its own cache directory. Old cache directories live in the system temp directory and are cleaned up by the OS.

## TPK vs `tjs compile`

| | `tjs compile` | `tjs app compile` |
|---|---|---|
| Input | Single `.js` file | Multi-file `app/` directory |
| Format | QuickJS bytecode | ZIP archive (source files) |
| Bundling needed? | Yes (use `tjs bundle` first) | No |
| Multiple files? | No | Yes (preserves directory structure) |
| Integrity check | No | SHA-256 |

Use `tjs compile` when you have a single bundled JavaScript file. Use `tjs app compile` when you want to package a multi-file application without a separate bundling step.

## Example: multi-file app

```bash
tjs app init
```

Edit `app/src/main.js`:

```javascript
import { greet } from './lib/greet.js';

greet('world');
```

Create `app/src/lib/greet.js`:

```javascript
export function greet(name) {
    console.log(`Hello, ${name}!`);
}
```

Build and run:

```bash
tjs app compile hello
./hello
# Hello, world!
```
