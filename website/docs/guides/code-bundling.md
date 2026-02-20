---
sidebar_position: 2
title: Code Bundling
---

# Code Bundling

txiki.js supports ES modules natively, but when deploying applications you may want to bundle all your source files into a single JavaScript file. This is especially useful for [standalone executables](standalone-executables.md) and for projects written in TypeScript.

[esbuild](https://esbuild.github.io/) is the recommended bundler for txiki.js projects. It's fast and handles both bundling and TypeScript type stripping in a single step.

### Basic usage

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

### Flags explained

| Flag | Purpose |
|------|---------|
| `--bundle` | Resolve all imports and bundle into a single file |
| `--outfile=bundle.js` | Output file path |
| `--external:tjs:*` | Don't bundle `tjs:*` standard library imports — they are provided by the runtime |
| `--target=esnext` | Use the latest JavaScript syntax (txiki.js supports ES2025) |
| `--platform=neutral` | Don't assume Node.js or browser globals |
| `--format=esm` | Output ES module format |
| `--main-fields=main,module` | Prefer the `module` entry point in `package.json` |

### TypeScript support

esbuild natively strips TypeScript types during bundling, so `.ts` and `.tsx` files work as input without any extra configuration. Note that esbuild does **not** perform type checking. You should use `tsc --noEmit` separately if you need that.

### Minification

Add `--minify` to reduce the output size:

```bash
npx esbuild my-app/index.ts \
    --bundle \
    --outfile=bundle.js \
    --external:tjs:* \
    --minify \
    --target=esnext \
    --platform=neutral \
    --format=esm \
    --main-fields=main,module
```

This is especially useful when creating [standalone executables](standalone-executables.md), as the bundled code is embedded in the resulting binary.

There are other interesting options availeble, check the [API documentation](https://esbuild.github.io/api/).
