# Welcome to the txiki.js documentation

[*txiki.js*](https://github.com/saghul/txiki.js) is a small and powerful JavaScript runtime.
It targets ECMAScript 2020 and implements many web platform features.

On this site you'll find documentation on all the APIs provided by it.

If there is any missing, please [open an issue](https://github.com/saghul/txiki.js/issues/new).

## Features

Support for the [ES2020] specification plus some ES2020+ features like top level await.

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
- [Storage API]
- [Streams API]
- [URL]
- [URLPattern]
- [URLSearchParams]
- [WebAssembly] (3)
- [WebSocket]
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

Other extras:

- Import directly from HTTP(S) URLs
- Import JSON files
- BigFloat and BigDecimal extensions
- Builtin test runner

### Standard library

Look at the modules on the left sidebar.

[alert, confirm, prompt]: https://developer.mozilla.org/en-US/docs/Web/API/Window/alert
[fetch]: https://fetch.spec.whatwg.org/
[EventTarget]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
[Console]: https://developer.mozilla.org/en-US/docs/Web/API/Console
[Crypto]: https://developer.mozilla.org/en-US/docs/Web/API/Crypto
[Encoding API]: https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API
[JSON modules]: https://github.com/tc39/proposal-json-modules
[Performance]: https://developer.mozilla.org/en-US/docs/Web/API/Performance
[setTimeout, setInterval]: https://developer.mozilla.org/en-US/docs/Web/API/setTimeout
[Storage API]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API
[Streams API]: https://developer.mozilla.org/en-US/docs/Web/API/Streams_API
[URL]: https://developer.mozilla.org/en-US/docs/Web/API/URL
[URLPattern]: https://developer.mozilla.org/en-US/docs/Web/API/URLPattern
[URLSearchParams]: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
[Web Workers API]: https://developer.mozilla.org/en-US/docs/Web/API/Worker
[WebAssembly]: https://developer.mozilla.org/en-US/docs/WebAssembly
[WebSocket]: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
[ES2020]: https://tc39.es/ecma262/
