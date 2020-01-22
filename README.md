
# txiki.js — The tiny JavaScript runtime

[![Build Status](https://travis-ci.org/saghul/txiki.js.svg?branch=master)](https://travis-ci.org/saghul/txiki.js)

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

See the [full API].

Other extras:

- Import directly from HTTP(S) URLs
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
git clone --recursive https://github.com/saghul/txiki.js && cd txiki.js
# Compile it!
make
# Run the REPL
./build/tjs
```

*NOTE:* The txiki.js build depends on a number of git submodules (e.g. [curl], [libuv]). If you didn't already clone this repository recursively, make sure you initialize these submodules with `git submodule update --init` before proceeding to the build.

[QuickJS]: https://bellard.org/quickjs/
[libuv]: https://libuv.org/
[curl]: https://github.com/curl/curl
[full API]: API.md
[CMake]: https://cmake.org/
