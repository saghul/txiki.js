# JavaScript API

## Globals

- `global`: reference to the global object.
- `globalThis`: same as `global`.
- `console`: a minimal JS console object with just the `log` method.
- `scriptArgs`: array with the arguments passed to the executable.
- `TextEncoder` / `TextDecoder`: WHATWG [Encoding API].
- `setTimeout` / `setInterval` / `clearTimeout` / `clearInterval`: standard timer functions.
- `std`: reference to the `std` module.
- `uv`: reference to the `uv` module.
- `workerThis`: reference to the worker global state (inside a worker).

## `std` module

- `exit([code])`: exits the program with the given code.
- `gc()`: triggers a garbage collection cycle.
- `evalScript(code)`: evals the given code in the global scope.
- `loadScript(jsFile)`: loads and evaulates the file at the given path.

## `uv` module

These APIs are almost always a 1-to-1 mapping of the matching [libuv] API, please
check the libuv documentation.

All synchronous APIs return a Promise, there are no callbacks.

- `cwd()`
- `environ()`
- `getenv(name)`
- `homedir()`
- `hrtime()`
- `isatty()`
- `setenv(name, value)`
- `signal(signum, cb)`
- `spawn(args, options)`
- `tmpdir()`
- `unsetenv(name)`

### TCP([family])

- `accept()`
- `bind({ ip, port }, [flags])`
- `close()`
- `connect({ ip, port })`
- `fileno()`
- `getpeername()`
- `getsockname()`
- `listen([backlog])`
- `read()`
- `shutdown()`
- `write(data)`

### UDP([family])

- `bind({ ip, port }, [flags])`
- `close()`
- `connect({ ip, port })`
- `fileno()`
- `getpeername()`
- `getsockname()`
- `recv(buffer, [offset, [length]])`
- `send(buffer, [offset, [length, [addr]]])`

### Pipe()

- `accept()`
- `bind({ ip, port })`
- `close()`
- `connect({ ip, port })`
- `fileno()`
- `getpeername()`
- `getsockname()`
- `listen([backlog])`
- `read()`
- `shutdown()`
- `write(data)`

### TTY(fd, readable)

- `close()`
- `fileno()`
- `getWinSize()`
- `read()`
- `setMode(mode)`
- `write(data)`

### Constants

- `AF_INET`
- `AF_INET6`
- `AF_UNSPEC`
- `STDERR_FILENO`
- `STDIN_FILENO`
- `STDOUT_FILENO`
- `SIG*`
- `UV_TTY_MODE_IO`
- `UV_TTY_MODE_NORMAL`
- `UV_TTY_MODE_RAW`

### Worker(path)

- `postMessage(obj)`
- `terminate()`

### Process

- `pid`
- `stdin`
- `stdout`
- `stderr`
- `kill(signum)`
- `wait()`

### `uv.fs` module

- `copyfile(path, newPath)`
- `rename(path, newPath)`
- `rmdir(path)`
- `mkdtemp(name)`
- `stat(path)`
- `lstat(path)`
- `open(path, flagsStr, mode)`
- `realpath(path)`
- `unlink(path)`

#### File

- `close()`
- `fileno()`
- `path`
- `read(buffer, [offset, [length, [position]]])`
- `stat()`
- `write(buffer, [offset, [length, [position]]])`

#### Constants

- `UV_FS_COPYFILE_EXCL`
- `UV_FS_COPYFILE_FICLONE`
- `UV_FS_COPYFILE_FICLONE_FORCE`

[Encoding API]: https://encoding.spec.whatwg.org/
[libuv]: https://github.com/libuv/libuv
