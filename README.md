
# QuickJS ❤️ libuv

This is an experiment in porting the [QuickJS] platform layer to use [libuv].

Currently the following is already implemented in the `qjs` interpreter, using libuv:

- TCP sockets
- TTY handles
- Timers
- I/O: file descriptor readyness
- Signals
- Event loop
- High-resolution time

More things may be coming!

## Building

CMake is necessary. This has been mostly tested on macOS, YMLMV.

```bash
# Compile it!
make
# Run the REPL
./build/qjs
```

[QuickJS]: https://bellard.org/quickjs/
[libuv]: https://libuv.org/
