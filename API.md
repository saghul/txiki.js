# JavaScript API

## Globals

- `global`: reference to the global object.
- `globalThis`: same as `global`.
- `window`: same as `global`.
- `console`: a minimal JS console object.
- `window.alert`: sames as `console.log`.
- `window.prompt`: User input function with line-editing.
- `TextEncoder` / `TextDecoder`: WHATWG [Encoding API].
- `setTimeout` / `setInterval` / `clearTimeout` / `clearInterval`: standard timer functions.
- `tjs`: reference to the main global module.
- `workerThis`: reference to the worker global state (inside a worker).

## `tjs` global

- `args`: array with the arguments passed to the executable.
- `exit([code])`: exits the program with the given code.
- `gc()`: triggers a garbage collection cycle.
- `evalScript(code)`: evals the given code in the global scope.
- `loadScript(jsFile)`: loads and evaulates the file at the given path.
- `platform`: string with the platform name.

These APIs are almost always a 1-to-1 mapping of the matching [libuv] API, please
check the libuv documentation.

All synchronous APIs return a Promise, there are no callbacks.

- `cwd()`
- `environ()`
- `exepath()`
- `getenv(name)`
- `gettimeofday()`
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
- `read([size])`
- `shutdown()`
- `write(String|Uint8Array)`

### UDP([family])

- `bind({ ip, port }, [flags])`
- `close()`
- `connect({ ip, port })`
- `fileno()`
- `getpeername()`
- `getsockname()`
- `recv([size])`
- `send(String|Uint8Array, [addr])`

### Pipe()

- `accept()`
- `bind({ ip, port })`
- `close()`
- `connect({ ip, port })`
- `fileno()`
- `getpeername()`
- `getsockname()`
- `listen([backlog])`
- `read([size])`
- `shutdown()`
- `write(String|Uint8Array)`

### TTY(fd, readable)

- `close()`
- `fileno()`
- `getWinSize()`
- `read([size])`
- `setMode(mode)`
- `write(String|Uint8Array)`

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

### `tjs.fs` submodule

- `copyfile(path, newPath)`
- `readdir(path)`
- `rename(path, newPath)`
- `rmdir(path)`
- `mkdtemp(name)`
- `stat(path)`
- `lstat(path)`
- `open(path, flagsStr, mode)`
- `readFile(path)`
- `realpath(path)`
- `unlink(path)`

#### File

- `close()`
- `fileno()`
- `path`
- `read([size, [offset]])`
- `stat()`
- `write(String|Uint8Array, [offset])`

#### Dir

- `path`
- `close()`
- `next()`

#### Constants

- `UV_FS_COPYFILE_EXCL`
- `UV_FS_COPYFILE_FICLONE`
- `UV_FS_COPYFILE_FICLONE_FORCE`

### `tjs.dns` submodule

- `getaddrinfo(node, [options])`

#### Constants

- `AI_PASSIVE`
- `AI_CANONNAME`
- `AI_NUMERICHOST`
- `AI_V4MAPPED`
- `AI_ALL`
- `AI_ADDRCONFIG`
- `AI_NUMERICSERV`

## Other builtins

All builtin modules are part of the **@tjs/xxx** namespace. Currently the following builtin
modules are provided:

- `@tjs/getopts`: https://github.com/jorgebucaran/getopts
- `@tjs/path`: https://github.com/browserify/path-browserify


[Encoding API]: https://encoding.spec.whatwg.org/
[libuv]: https://github.com/libuv/libuv
