---
sidebar_position: 3
title: TypeScript
---

# TypeScript

txiki.js provides TypeScript type definitions via the [@txikijs/types](https://www.npmjs.com/package/@txikijs/types) npm package.

## Installation

```bash
npm install @txikijs/types --save-dev
```

This package includes type definitions for all txiki.js APIs, enabling autocompletion and type checking in your editor.

## Transpiling

txiki.js doesn't run TypeScript directly, `.ts` files need to be transpiled to JavaScript first. The recommended approach is to use [esbuild](https://esbuild.github.io/), which handles both TypeScript type stripping and bundling in a single fast step.

See the [Code Bundling](guides/code-bundling.md) guide for the full setup.
