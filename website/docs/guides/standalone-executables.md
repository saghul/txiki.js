---
sidebar_position: 1
title: Standalone Executables
---

# Creating Standalone Executables

Creating standalone executables is possible with `tjs compile`. The resulting executable will bundle the given code and the txiki.js runtime. No compiler is needed.

## Basic usage

Assuming a `bundle.js` file with some JS code, the following command will create a standalone executable:

```bash
tjs compile bundle.js
```

The new executable will be called `bundle` on Unix platforms and `bundle.exe` on Windows.

## Custom output name

The output name can be customized by passing a second option:

```bash
tjs compile bundle.js myexe
```

## Bundling your code

The `tjs compile` command doesn't do any code bundling — it expects a single JavaScript file as input. If your application spans multiple files or uses TypeScript, you'll need to bundle it first.

See the [Code Bundling](code-bundling.md) guide for instructions on using esbuild to bundle (and optionally minify) your app into a single file ready for `tjs compile`.
