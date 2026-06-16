---
sidebar_position: 2
title: CLI Reference
---

# CLI Reference

The `tjs` binary is the entry point to txiki.js. It runs scripts, evaluates expressions, serves HTTP applications, runs tests, bundles and compiles code, and provides an interactive REPL.

```bash
tjs [options] [subcommand] [args]
```

Run `tjs --help` for a summary, or `tjs <subcommand> --help`-style usage by invoking a subcommand with missing arguments.

## Global options

These options apply before the subcommand:

| Option | Description |
|--------|-------------|
| `-v`, `--version` | Print the version (`v<version>`) and exit |
| `-h`, `--help` | Print help and exit |
| `--memory-limit LIMIT` | Set the memory limit (in bytes) for the JavaScript runtime |
| `--stack-size SIZE` | Maximum JavaScript stack size, in bytes (default: 1024 KB) |
| `--wasm-stack-size SIZE` | WebAssembly stack size, in bytes (default: 512 KB) |
| `--tls-ca FILE` | Path to a custom CA bundle PEM file (overrides the embedded Mozilla bundle) |

## Subcommands

### `tjs run`

Run a JavaScript program.

```bash
tjs run app.js
```

| Option | Description |
|--------|-------------|
| `--import-map FILE` | Path to an [import map](guides/modules.md#import-maps) JSON file |

If the file ends in `.wasm`, `tjs run` acts as a [WASI](#running-wasi-modules) runner instead of evaluating JavaScript.

### `tjs eval`

Evaluate a JavaScript expression passed on the command line:

```bash
tjs eval "console.log(1 + 1)"
```

### `tjs serve`

Serve an HTTP (or HTTPS) application from a module that default-exports a `fetch` handler:

```bash
tjs serve app.js
```

See the [Serving HTTP](guides/serve.md) guide for the module shape, WebSocket support, and TLS options.

### `tjs test`

Run every `test-*.js` file in a directory (defaults to the current directory). Each test runs as a separate `tjs run` subprocess.

```bash
tjs test tests/
```

The test runner is tuned with environment variables:

| Variable | Description |
|----------|-------------|
| `VERBOSE_TESTS` | When set, print verbose output |
| `TJS_TEST_TIMEOUT` | Per-test timeout in milliseconds (default `30000`) |
| `TJS_TEST_CONCURRENCY` | Number of tests to run in parallel (default: `navigator.hardwareConcurrency`) |

### `tjs bundle`

Bundle a JavaScript/TypeScript file (and its imports) into a single file using esbuild.

```bash
tjs bundle app.js bundle.js
```

See the [Code Bundling](guides/code-bundling.md) guide for options and details.

### `tjs compile`

Compile a single JavaScript file into a self-contained standalone executable.

```bash
tjs compile bundle.js
```

See the [Standalone Executables](guides/standalone-executables.md) guide.

### `tjs app`

Manage [TPK app packages](guides/app-packages.md) — multi-file applications packaged into a `.tpk` archive or a standalone executable.

```bash
tjs app init      # scaffold a new app
tjs app pack      # package into a .tpk file
tjs app compile   # compile into a standalone executable
```

## The REPL

Running `tjs` with no subcommand on a TTY starts an interactive read-eval-print loop with syntax-highlighted output and persistent command history.

```bash
tjs
```

Lines starting with `.` are directives rather than JavaScript:

| Directive | Description |
|-----------|-------------|
| `.help` | Print the directive list |
| `.time` | Toggle display of evaluation timing |
| `.strict` | Toggle strict-mode evaluation |
| `.depth N` | Set the object inspection depth (default `2`) |
| `.hidden` | Toggle display of non-enumerable properties |
| `.color` | Toggle colored output |
| `.dark` | Select the dark color theme |
| `.light` | Select the light color theme |
| `.clear` | Clear the terminal |
| `.clear-history` | Clear the command history |
| `.load FILE` | Load and evaluate source from a file |
| `.quit` | Exit the REPL |

The toggle directives (`.time`, `.strict`, `.hidden`, `.color`) accept an optional boolean argument, e.g. `.color yes`. Command history is persisted to `$TJS_HOME/history.db` (see [environment variables](#environment-variables)); on builds compiled without SQLite, history is silently disabled.

## Reading a script from stdin

When `tjs` is run with no subcommand and stdin is **not** a TTY, it reads the entire input and evaluates it as a script. This makes `tjs` convenient in pipelines:

```bash
echo "console.log('hi')" | tjs
tjs < script.js
```

## Running WASI modules

When the argument to `tjs run` ends in `.wasm`, txiki.js instantiates it as a [WASI](https://wasi.dev/) module against `wasi_snapshot_preview1`. The current directory (`.`) and the filesystem root (`/`) are pre-opened, any trailing arguments are forwarded to the module as WASI arguments, and the guest's exit code becomes the process exit code.

```bash
tjs run module.wasm arg1 arg2
```

For programmatic control over WASI, use the [`tjs:wasi`](/docs/api/tjs-wasi) module directly.

## Environment variables

| Variable | Description |
|----------|-------------|
| `TJS_HOME` | Overrides the home/cache directory (default `~/.tjs`). Stores the HTTP cookie jar (`cookies.txt`), the cached esbuild binary (`esbuild/<version>/`), and the REPL history database (`history.db`). |
| `TJS_CA_BUNDLE` | Path to a custom TLS CA bundle PEM file. |
| `SSL_CERT_FILE` | Fallback path to a custom TLS CA bundle PEM file. |

The CA bundle is resolved with the precedence `--tls-ca` > `TJS_CA_BUNDLE` > `SSL_CERT_FILE` > the embedded Mozilla bundle.

Outbound HTTP requests also honor the standard proxy environment variables — see the [HTTP Proxy Support](guides/http-proxy.md) guide.
