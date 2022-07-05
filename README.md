
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
- [JSON modules]
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

See the [full API documentation].

Other extras:

- Import directly from HTTP(S) URLs
- Import JSON files
- BigFloat and BigDecimal extensions

### Standard library

The builtin `@tjs/std` module exports the following:

- [getopts] module
- [ipaddr] module
- [path] module
- [uuid] module
- `createHash` function

### ffi

The builtin `@tjs/ffi` module provides access to FFI functionality.

## Supported platforms

* GNU/Linux
* macOS
* Windows (beta)
* Other Unixes (please test!)

## Building

[CMake] is necessary.

*NOTE:* The txiki.js build depends on a number of git submodules (e.g. [libuv], [wasm3]).
If you didn't already clone this repository recursively, make sure you initialize these
submodules with `git submodule update --init` before proceeding to the build.

### Unix systems

```bash
# Get the code
git clone --recursive https://github.com/saghul/txiki.js --shallow-submodules && cd txiki.js
# Compile it!
make
# Run the REPL
./build/tjs
```

### Windows (beta)

<details>
Windows support it's currently considered beta. Tests do pass, but building it is not as easy as it should be.

Building has only been tested in 64bit Windows.

#### Prerequisites

First make sure you have [MSYS2](https://www.msys2.org) installed. The `mingw64` and `clang64` environments are currently tested.

Then install the required dependencies:

```bash
pacman -S git make pactoys
pacboy -S curl-winssl:p toolchain:p cmake:p ninja:p
```

#### Build

These commands must be run in a MinGW64 or clang64 shell.

```bash
make
```

This will build the executable just like on Unix. Note that at this point there are a number of dynamically linked libraries, so if you want to use the executable on a different system you'll need to copy those too. Check the list with `ldd build/tjs.exe`.

#### Running the tests

Make sure these commands are run from Windows Terminal (mintty, what MSYS2 provides is not supported).

```bash
make test
```

</details>

## Versioning

At this time txiki.js uses [calendar versioning] with the form YY.MM.MICRO.

## Thanks

txiki.js stands on shoulders of giants. It wouldn't be what it is today without these libraries:

* [QuickJS]: JavaScript engine
* [libuv]: platform abstraction layer
* [wasm3]: WASM engine
* [curl]: HTTP client
* [libffi]: Call native functions from C

In addition, txiki.js has these [contributors] to thank for their help.

Thank you all for making this project possible!


[QuickJS]: https://bellard.org/quickjs/
[libuv]: https://libuv.org/
[curl]: https://github.com/curl/curl
[full API documentation]: https://bettercallsaghul.com/txiki.js/api/
[CMake]: https://cmake.org/
[wasm3]: https://github.com/wasm3/wasm3
[contributors]: https://github.com/saghul/txiki.js/graphs/contributors
[alert, confirm, prompt]: https://developer.mozilla.org/en-US/docs/Web/API/Window/alert
[fetch]: https://fetch.spec.whatwg.org/
[EventTarget]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
[Console]: https://developer.mozilla.org/en-US/docs/Web/API/Console
[Crypto]: https://developer.mozilla.org/en-US/docs/Web/API/Crypto
[Encoding API]: https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API
[JSON modules]: https://github.com/tc39/proposal-json-modules
[Performance]: https://developer.mozilla.org/en-US/docs/Web/API/Performance
[setTimeout, setInterval]: https://developer.mozilla.org/en-US/docs/Web/API/setTimeout
[Streams API]: https://developer.mozilla.org/en-US/docs/Web/API/Streams_API
[URL]: https://developer.mozilla.org/en-US/docs/Web/API/URL
[URLPattern]: https://developer.mozilla.org/en-US/docs/Web/API/URLPattern
[URLSearchParams]: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
[Web Workers API]: https://developer.mozilla.org/en-US/docs/Web/API/Worker
[WebAssembly]: https://developer.mozilla.org/en-US/docs/WebAssembly
[getopts]: https://github.com/jorgebucaran/getopts
[ipaddr]: https://github.com/whitequark/ipaddr.js
[path]: https://github.com/browserify/path-browserify
[uuid]: https://github.com/uuidjs/uuid
[calendar versioning]: https://calver.org/
