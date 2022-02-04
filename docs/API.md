# JavaScript API

## Globals

- `global`: reference to the global object.
- `globalThis`: same as `global`.
- `window`: same as `global`.
- `tjs`: reference to the main global module.

## `tjs` global

All custom APIs provided by txiki.js are exposed at the top level inside the `tjs global.
These APIs are almost always a 1-to-1 mapping of the matching [libuv] API, please
check the libuv documentation.

### Sockets

#### TCP([family])

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

#### UDP([family])

- `bind({ ip, port }, [flags])`
- `close()`
- `connect({ ip, port })`
- `fileno()`
- `getpeername()`
- `getsockname()`
- `recv(Uint8Array)`
- `send(Uint8Array, [addr])`

#### Pipe()

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

### Basic DNS resolution

- `getaddrinfo(node, [options])`

### Operating system facilities

- `cwd()`
- `environ`
- `exepath`
- `getenv(name)`
- `gettimeofday()`
- `homedir()`
- `hrtime()`
- `hrtimeMs()`
- `isatty()`
- `setenv(name, value)`
- `signal(signum, cb)`
- `tmpdir()`
- `unsetenv(name)`
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
- `exit(code)`

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

#### Filesystem watching

- `watch(path, cb)`

#### Child processes

- `spawn(args, options)`

##### Process

- `pid`
- `stdin`
- `stdout`
- `stderr`
- `kill(signum)`
- `wait()`

### Platform functions

- `args`: array with the arguments passed to the executable.
- `gc()`: triggers a garbage collection cycle.
- `platform`: string with the platform name.
- `version`: string with the `txiki.js` version.
- `versions`: object with the bundled library versions.

### Constants

- `AF_INET`
- `AF_INET6`
- `AF_UNSPEC`
- `AI_PASSIVE`
- `AI_CANONNAME`
- `AI_NUMERICHOST`
- `AI_V4MAPPED`
- `AI_ALL`
- `AI_ADDRCONFIG`
- `AI_NUMERICSERV`
- `COPYFILE_EXCL`
- `COPYFILE_FICLONE`
- `COPYFILE_FICLONE_FORCE`
- `DIRENT_BLOCK`
- `DIRENT_CHAR`
- `DIRENT_DIR`
- `DIRENT_FIFO`
- `DIRENT_FILE`
- `DIRENT_LINK`
- `DIRENT_SOCKET`
- `DIRENT_UNKNOWN`
- `FS_EVENT_CHANGE`
- `FS_EVENT_RENAME`
- `SIG*`
- `S_IFBLK`
- `S_IFCHR`
- `S_IFDIR`
- `S_IFIFO`
- `S_IFLNK`
- `S_IFMT`
- `S_IFREG`
- `S_IFSOCK`
- `S_ISGID`
- `S_ISUID`
- `STDERR_FILENO`
- `STDIN_FILENO`
- `STDOUT_FILENO`

[libuv]: https://github.com/libuv/libuv
