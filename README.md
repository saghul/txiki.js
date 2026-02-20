<p align="center">
    <img width="240" src="https://raw.githubusercontent.com/saghul/txiki.js/master/website/static/img/logo-heartonly.png" />
</p>

# txiki.js — The tiny JavaScript runtime

> **txikia** (Basque): small, tiny.

*txiki.js* is a small and powerful JavaScript runtime. It targets state-of-the-art ECMAScript
and aims to be [WinterTC] compliant.

It's built on the shoulders of giants: it uses [QuickJS-ng] as its JavaScript engine and [libuv] as the platform layer.

## Quick start

```bash
# Get the code
git clone --recursive https://github.com/saghul/txiki.js --shallow-submodules && cd txiki.js
# Compile it!
make
# Run the REPL
./build/tjs
```

See [Building](https://bettercallsaghul.com/txiki.js/docs/building) for detailed instructions including Windows support.

## Features

- Web Platform APIs: `fetch`, `WebSocket`, `Console`, `setTimeout`, `Crypto`, Web Workers, and more
- TCP, UDP, and Unix sockets
- HTTP server with WebSocket support
- File I/O, child processes, signal handling
- Standard library: `tjs:sqlite`, `tjs:ffi`, `tjs:path`, `tjs:hashing`, and more
- Standalone executables via `tjs compile`

## Documentation

Full documentation is available at **[bettercallsaghul.com/txiki.js](https://bettercallsaghul.com/txiki.js/)**.

## Supported platforms

* GNU/Linux
* macOS
* Windows
* Other Unixes (please test!)

<br />

<footer>
<p align="center" style="font-size: smaller;">
Built with ❤️ by saghul and these awesome <a href="https://github.com/saghul/txiki.js/graphs/contributors" target="_blank">contributors</a>.
</footer>

[QuickJS-ng]: https://github.com/quickjs-ng/quickjs
[libuv]: https://libuv.org/
[WinterTC]: https://wintertc.org/
