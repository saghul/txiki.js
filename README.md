
# txiki.js — The tiny JavaScript runtime

[![Build Status](https://github.com/saghul/txiki.js/workflows/CI/badge.svg)](https://github.com/saghul/txiki.js/actions)

## Overview

> **txikia** (basque): small, tiny.

*txiki.js* is a small and powerful JavaScript runtime. It's built on the shoulders of
giants: it uses [QuickJS] as its JavaScript engine, [libuv] as the platform layer,
[wasm3] as the WebAssembly engine and [curl] as the HTTP client.

## Features

### Web Platform APIs

- [alert, confirm, prompt] (1)
- [Console]
- [Crypto] (2)
- [Encoding API]
- [EventTarget]
- [fetch]
- [Performance]
- [setTimeout, setInterval]
- [Streams API]
- [URL]
- [URLPattern]
- [URLSearchParams]
- [WebAssembly] (3)
- [Web Workers API]

(1): All of them are async.

(2): No subtle support.

(3): No tables, globals or memory support.

### Runtime features

- TCP and UDP sockets
- Unix sockets / named pipes
- Signal handling
- File operations
- Child processes
- DNS (getaddrinfo)
- WASI
- Miscellaneous utility functions

See the [full API].

Other extras:

- Import directly from HTTP(S) URLs
- Import JSON files
- BigFloat and BigDecimal extensions

### Standard library

The builtin `@tjs/std` module exports the following:

- [getopts] module
- [path] module
- [uuid] module
- `createHash` function

## Supported platforms

* GNU/Linux
* macOS
* Windows (experimental)
* Other Unixes (please test!)

## Building

[CMake] is necessary.

```bash
# Get the code
git clone --recursive https://github.com/saghul/txiki.js --shallow-submodules && cd txiki.js
# Compile it!
make
# Run the REPL
./build/tjs
```

*NOTE:* The txiki.js build depends on a number of git submodules (e.g. [curl], [libuv]).
If you didn't already clone this repository recursively, make sure you initialize these
submodules with `git submodule update --init` before proceeding to the build.

## Thanks

txiki.js stands on shoulders of giants. It wouldn't be what it is today without these libraries:

* [QuickJS]: JavaScript engine
* [libuv]: platform abstraction layer
* [wasm3]: WASM engine
* [curl]: HTTP client

In addition, txiki.js has these [contributors] to thank for their help.

Thank you all for making this project possible!


[QuickJS]: https://bellard.org/quickjs/
[libuv]: https://libuv.org/
[curl]: https://github.com/curl/curl
[full API]: API.md
[CMake]: https://cmake.org/
[wasm3]: https://github.com/wasm3/wasm3
[contributors]: https://github.com/saghul/txiki.js/graphs/contributors
[alert, confirm, prompt]: https://developer.mozilla.org/en-US/docs/Web/API/Window/alert
[fetch]: https://fetch.spec.whatwg.org/
[EventTarget]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
[Console]: https://developer.mozilla.org/en-US/docs/Web/API/Console
[Crypto]: https://developer.mozilla.org/en-US/docs/Web/API/Crypto
[Encoding API]: https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API
[Performance]: https://developer.mozilla.org/en-US/docs/Web/API/Performance
[setTimeout, setInterval]: https://developer.mozilla.org/en-US/docs/Web/API/setTimeout
[Streams API]: https://developer.mozilla.org/en-US/docs/Web/API/Streams_API
[URL]: https://developer.mozilla.org/en-US/docs/Web/API/URL
[URLPattern]: https://developer.mozilla.org/en-US/docs/Web/API/URLPattern
[URLSearchParams]: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
[Web Workers API]: https://developer.mozilla.org/en-US/docs/Web/API/Worker
[WebAssembly]: https://developer.mozilla.org/en-US/docs/WebAssembly
[getopts]: https://github.com/jorgebucaran/getopts
[path]: https://github.com/browserify/path-browserify
[uuid]: https://github.com/uuidjs/uuid
