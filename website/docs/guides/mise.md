---
sidebar_position: 0
title: Using with mise
---

# Using txiki.js with mise

[mise](https://mise.jdx.dev/) (mise-en-place) is a polyglot tool-version manager. Use it to
pin a specific txiki.js version per project and put `tjs` on your `PATH` — no system-wide
install, reproducible across machines and CI.

:::note
txiki.js isn't in the mise registry yet, so you install it straight from GitHub Releases via
mise's `github` backend. Prebuilt binaries exist for **macOS** (arm64 / x86_64) and
**Windows** (x86_64) only. On Linux and other Unixes there is no release binary — [build from
source](../building.md) instead.
:::

## Prerequisites

Install mise — see the [mise installation docs](https://mise.jdx.dev/installing-mise.html) —
then verify:

```bash
mise --version
```

## Add txiki.js to a project

From your project root:

```bash
mise use "github:saghul/txiki.js[exe=tjs]"
```

This installs the latest release and writes a `mise.toml`:

```toml
[tools]
"github:saghul/txiki.js" = { version = "latest", exe = "tjs" }
```

- `github:saghul/txiki.js` — fetch the binary from the project's GitHub Releases.
- `exe = "tjs"` — the release archive ships a `tjs` binary; this tells mise which executable
  to expose.

Commit `mise.toml` so everyone on the project gets the same runtime.

## Pin a version

Reproducible builds want an exact version instead of `latest`:

```bash
mise use "github:saghul/txiki.js[exe=tjs]@26.6.0"
```

List the available versions:

```bash
mise ls-remote "github:saghul/txiki.js"
```

Upgrade later with `mise upgrade` (respects your version spec) or by editing `mise.toml`.

## Run tjs

Run through mise:

```bash
mise exec -- tjs run app.js
mise exec -- tjs --version
```

Or [activate mise in your shell](https://mise.jdx.dev/getting-started.html#activate-mise) 
so `tjs` is on your `PATH` automatically inside the project directory:

```bash
tjs run app.js
```

## Define project tasks

mise doubles as a task runner, handy for wiring scripts to the pinned runtime:

```toml
[tools]
"github:saghul/txiki.js" = { version = "26.6.0", exe = "tjs" }

[tasks.start]
run = "tjs run src/main.js"

[tasks.test]
run = "tjs test tests/"
description = "Run the test suite"
```

run task in terminal:

```bash
mise run start # or: mise start
mise run test  # or: mise test
mise run       # interactive TUI
```

## CI

Install the pinned tools with one command, then run as usual:

```bash
mise install
mise exec -- tjs run app.js
```

Or use the official [mise GitHub Action](https://github.com/jdx/mise-action), which reads
`mise.toml` and puts `tjs` on the `PATH`:

```yaml
- uses: jdx/mise-action@v2
- run: tjs run app.js
```

---

## Older versions of txiki.js (&lt;26.5.0)

:::note
To use txiki.js **26.5.0 or earlier**, use mise's `ubi` backend instead:\
`mise use "ubi:saghul/txiki.js[exe=tjs]@26.5.0"` — which force-marks the binary executable. 
Note that `ubi` is deprecated in mise (slated for removal in 2027.1.0).

<details>
<summary>See example of `mise.toml` file</summary>

```toml
[tools]
"ubi:saghul/txiki.js" = { version = "26.4.0", exe = "tjs" }
```

you will see in the terminal:

```bash
mise WARN  deprecated [ubi]: The ubi backend is deprecated. Use the github backend instead (e.g., github:owner/repo). This will be removed in mise 2027.1.0.
mise Installed executable into /Users/you/.local/share/mise/installs/ubi-saghul-txiki-js/26.4.0/tjs
ubi:saghul/txiki.js@26.4.0 checksum generate macos-arm64-tjs-tjs                                    
```
</details>
:::


