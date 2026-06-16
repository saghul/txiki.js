---
sidebar_position: 100
title: Versioning
---

# Versioning

txiki.js uses [calendar versioning](https://calver.org/) with the form **YY.MM.MICRO**:

- **YY** — two-digit year of the release.
- **MM** — month of the release (not zero-padded).
- **MICRO** — patch number within that month, starting at `0`.

For example, `24.6.1` is the second release made in June 2024.

## Checking the version

From the command line:

```bash
tjs --version    # prints e.g. v24.6.1
```

At runtime, the version is available as a global, and the versions of the bundled
components (QuickJS, libuv, libwebsockets, WAMR, SQLite, mimalloc) are exposed under
`tjs.engine.versions`:

```js
console.log(tjs.version);                  // "24.6.1"
console.log(tjs.engine.versions.quickjs);  // bundled QuickJS-ng version
console.log(tjs.engine.versions.uv);       // bundled libuv version
```

See [`tjs.version`](/docs/api/global.tjs.Variable.version) and [`tjs.engine.versions`](/docs/api/global.tjs.Namespace.engine).

## Stability

txiki.js targets state-of-the-art ECMAScript and [WinterTC](https://wintertc.org/) compliance,
and the core APIs documented here are intended to be stable across releases. Some surfaces are
explicitly experimental and may change between versions — these are called out in their own docs,
for example the [TPK app package](guides/app-packages.md) format and the `tjs app` commands.

## Releases and changelog

Releases are published on the [GitHub Releases](https://github.com/saghul/txiki.js/releases) page,
which serves as the de-facto changelog.
