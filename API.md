# JavaScript API

## Globals

- `global`: reference to the global object.
- `globalThis`: same as `global`.
- `window`: same as `global`.
- `window.alert`: sames as `console.log`.
- `window.prompt`: simple user input function.
- `tjs`: reference to the main global module.

## `tjs` global

- `args`: array with the arguments passed to the executable.
- `exit([code])`: exits the program with the given code.
- `gc()`: triggers a garbage collection cycle.
- `evalScript(code)`: evals the given code in the global scope.
- `loadScript(jsFile)`: loads and evaulates the file at the given path.
- `platform`: string with the platform name.
- `version`: string with the `txiki.js` version.
- `versions`: object with the bundled library versions.

These APIs are almost always a 1-to-1 mapping of the matching [libuv] API, please
check the libuv documentation.

All asynchronous APIs return a Promise, there are no callbacks.

- `cwd()`
- `environ()`
- `exepath()`
- `getenv(name)`
- `gettimeofday()`
- `homedir()`
- `hrtime()`
- `hrtimeMs()`
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
- `read(Uint8Array)`
- `shutdown()`
- `write(Uint8Array)`

### UDP([family])

- `bind({ ip, port }, [flags])`
- `close()`
- `connect({ ip, port })`
- `fileno()`
- `getpeername()`
- `getsockname()`
- `recv(Uint8Array)`
- `send(Uint8Array, [addr])`

### Pipe()

- `accept()`
- `bind({ ip, port })`
- `close()`
- `connect({ ip, port })`
- `fileno()`
- `getpeername()`
- `getsockname()`
- `listen([backlog])`
- `read(Uint8Array)`
- `shutdown()`
- `write(Uint8Array)`

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
- `mkstemp(name)`
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
- `read(Uint8Array, [offset])`
- `stat()`
- `write(Uint8Array, [offset])`

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

[libuv]: https://github.com/libuv/libuv
