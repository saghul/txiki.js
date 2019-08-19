
# quv — QuickJS ❤️ libuv

This is an experiment in using [libuv] as the platform layer for [QuickJS].

Currently the following is already implemented in the `quv` (formerly `qjs`) interpreter, using libuv:

- TCP and UDP sockets
- TTY handles
- Unix sockets / named pipes
- Timers
- Signals
- Basic file operations
- Event loop
- High-resolution time
- Miscellaneous utility functions
- Worker threads

Other extras:

- TextEncoder / TextDecoder APIs

See the [full API].

## Building

CMake is necessary. This has been mostly tested on macOS, YMLMV.

```bash
# Compile it!
make
# Run the REPL
./build/quv
```

[QuickJS]: https://bellard.org/quickjs/
[libuv]: https://libuv.org/
[full API]: API.md
