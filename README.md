
# quv — QuickJS ❤️ libuv

[![Build Status](https://travis-ci.org/saghul/quv.svg?branch=master)](https://travis-ci.org/saghul/quv)

This is an experiment in using [libuv] as the platform layer for [QuickJS].

Currently the following is already implemented in the `quv` (formerly `qjs`) interpreter, using libuv:

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

Other extras:

- TextEncoder / TextDecoder APIs
- URL polyfill
- Import directly from HTTP(S) URLs

See the [full API].

## Building

CMake is necessary.

```bash
# Get the code
git clone --recursive https://github.com/saghul/quv && cd quv
# Compile it!
make
# Run the REPL
./build/quv
```

[QuickJS]: https://bellard.org/quickjs/
[libuv]: https://libuv.org/
[full API]: API.md
