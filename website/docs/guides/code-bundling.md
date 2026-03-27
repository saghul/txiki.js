---
sidebar_position: 2
title: Code Bundling
---

# Code Bundling

txiki.js supports ES modules natively, but when deploying applications you may want to bundle all your source files into a single JavaScript file. This is especially useful for [standalone executables](standalone-executables.md) and for projects written in TypeScript.

[esbuild](https://esbuild.github.io/) is the recommended bundler for txiki.js projects. It's fast and handles both bundling and TypeScript type stripping in a single step.

## Using `tjs bundle`

txiki.js ships with a built-in `bundle` command that automatically downloads esbuild (if needed) and runs it with the right flags for txiki.js compatibility. No extra tools or dependencies required.

### Basic usage

```bash
tjs bundle my-app/index.js bundle.js
```

If you omit the output file, it defaults to `<name>.bundle.js`:

```bash
tjs bundle my-app/index.js
# produces my-app/index.bundle.js
```

### TypeScript support

esbuild natively strips TypeScript types during bundling, so `.ts` and `.tsx` files work as input without any extra configuration. Note that esbuild does **not** perform type checking. You should use `tsc --noEmit` separately if you need that.

```bash
tjs bundle my-app/index.ts bundle.js
```

### Minification

Add `--minify` (or `-m`) to reduce the output size:

```bash
tjs bundle --minify my-app/index.ts bundle.js
```

This is especially useful when creating [standalone executables](standalone-executables.md), as the bundled code is embedded in the resulting binary.

### How it works

The first time you run `tjs bundle`, the esbuild binary is downloaded from the npm registry and cached in `~/.tjs/esbuild/<version>/`. Subsequent runs reuse the cached binary. The download requires no system tools since it uses the built-in `fetch` API and `DecompressionStream` to stream the tarball directly to disk.

Under the hood, `esbuild` is invoked with the following flags:

| Flag | Purpose |
|------|---------|
| `--bundle` | Resolve all imports and bundle into a single file |
| `--external:tjs:*` | Don't bundle `tjs:*` standard library imports — they are provided by the runtime |
| `--target=esnext` | Use the latest JavaScript syntax (txiki.js supports ES2025) |
| `--platform=neutral` | Don't assume Node.js or browser globals |
| `--format=esm` | Output ES module format |
| `--main-fields=main,module` | Prefer the `module` entry point in `package.json` |

## Source maps

txiki.js automatically detects and uses source maps to remap stack traces back to your original source files. This works with both inline and external source maps.

### Generating source maps

Add `--sourcemap=inline` to embed the source map directly in the bundle:

```bash
tjs bundle --sourcemap=inline my-app/index.ts bundle.js
```

Or use `--sourcemap` to generate a separate `.map` file:

```bash
tjs bundle --sourcemap my-app/index.ts bundle.js
# produces bundle.js and bundle.js.map
```

### How it works

When an error occurs, txiki.js reads the `//# sourceMappingURL` comment in the source file and uses the source map to translate bundled positions back to original file and line numbers. This happens lazily (only when an error is thrown) so there is no overhead during normal execution.

For example, given an error in bundled code, instead of:

```
Error: something went wrong
    at throwFromA (bundle.js:5:9)
```

You'll see the original source location:

```
Error: something went wrong
    at throwFromA (src/a.ts:12:5)
```

Both inline source maps (`data:` URLs) and external `.map` files are supported.

## Using esbuild directly

If you need more control over the bundling process, you can invoke esbuild directly:

```bash
npx esbuild my-app/index.ts \
    --bundle \
    --outfile=bundle.js \
    --external:tjs:* \
    --target=esnext \
    --platform=neutral \
    --format=esm \
    --main-fields=main,module
```

There are other interesting options available, check the [API documentation](https://esbuild.github.io/api/).
