
# txiki.js — The tiny JavaScript runtime

[![Build Status](https://github.com/saghul/txiki.js/workflows/CI/badge.svg)](https://github.com/saghul/txiki.js/actions)

## Overview

> **txikia** (basque): small, tiny.

*txiki.js* is a small and powerful JavaScript runtime. It's built on the shoulders of
giants: it uses [QuickJS] as its JavaScript engine and [libuv] as the platform layer.

It was formerly named *quv*.

## Features

### Browser-like APIs

- Console API
- URL & URLSearchParams
- TextEncoder / TextDecoder APIs
- EventTarget / Event / CustomEvent
- XMLHttpRequest & fetch (including AbortController)
- Performance API
- Worker API
- Crypto API (just getRandomValues)
- WebAssembly (no tables, globals or memory support yet)

### Custom features

- TCP and UDP sockets
- TTY handles
- Unix sockets / named pipes
- Timers
- Signals
- File operations
- Event loop
- High-resolution time
- Miscellaneous utility functions
- Worker threads
- Child processes
- DNS (getaddrinfo)
- WASI (no memory support yet)

See the [full API].

Other extras:

- Import directly from HTTP(S) URLs
- Import JSON files
- path module
- uuid module
- hashlib module
- BigFloat and BigDecimal extensions

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

*NOTE:* The txiki.js build depends on a number of git submodules (e.g. [curl], [libuv]). If you didn't already clone this repository recursively, make sure you initialize these submodules with `git submodule update --init` before proceeding to the build.

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
