---
sidebar_position: 4
title: Filesystem
---

# Filesystem

txiki.js exposes the filesystem through the `tjs` global. Every operation is asynchronous and returns a `Promise`, so file I/O never blocks the event loop. This guide covers reading and writing whole files, working with open file handles and streams, iterating directories, inspecting metadata, and managing temporary files.

## Reading a whole file

`tjs.readFile()` reads the entire contents of a file and resolves to a `Uint8Array`. Decode it to text with a `TextDecoder`:

```js
const bytes = await tjs.readFile('hello.txt');
const text = new TextDecoder().decode(bytes);
console.log(text);
```

Binary data needs no decoding — use the `Uint8Array` directly:

```js
const png = await tjs.readFile('logo.png');
console.log(`read ${png.byteLength} bytes`);
```

## Writing a file

`tjs.writeFile()` replaces a file's contents (creating it if needed). It accepts either a string (encoded as UTF-8) or a `Uint8Array`:

```js
// Strings are written as UTF-8.
await tjs.writeFile('greeting.txt', 'hello, world\n');

// Binary data works too.
await tjs.writeFile('data.bin', new Uint8Array([1, 2, 3]));
```

Pass a `mode` to set the permission bits when the file is created (defaults to `0o644`):

```js
await tjs.writeFile('secret.txt', 'token', { mode: 0o600 });
```

## Opening file handles

For finer control — random access, partial reads, streaming, appending — open a handle with `tjs.open()`. It takes an `fopen`-style flags string and resolves to a `FileHandle`. Handles are binary by default.

```js
const f = await tjs.open('notes.txt', 'r');
// ... use the handle ...
await f.close();
```

### Open flags

| Flag | Description |
| ---- | ----------- |
| `r`  | Open for reading. |
| `w`  | Open for writing, truncating the file if it exists. |
| `a`  | Open for writing, appending at the end if the file exists. |
| `x`  | Open with exclusive creation; fails if the file already exists. |
| `+`  | Open for updating (both reading and writing). |

The base flags combine with `+` and `x` in the usual way — for example `r+` (read/write, file must exist), `w+` (read/write, truncate), `a+` (read/append), and `wx` (create, fail if present). The optional third argument to `tjs.open()` is the `mode` applied when the file is created (defaults to `0o666`).

### Reading and writing through a handle

`read()` fills a buffer and resolves to the number of bytes read, or `null` at end of file. `write()` writes a buffer and resolves to the number of bytes written. Both take an optional file `offset`; without it, they continue from the handle's current position.

```js
const f = await tjs.open('notes.txt', 'r');
const buf = new Uint8Array(4096);
const n = await f.read(buf);          // n bytes, or null at EOF
if (n !== null) {
    const chunk = new TextDecoder().decode(buf.subarray(0, n));
    console.log(chunk);
}
await f.close();
```

Use the `offset` argument for random access — here we overwrite 5 bytes starting at byte 10:

```js
const f = await tjs.open('data.bin', 'r+');
await f.write(new Uint8Array([0, 1, 2, 3, 4]), 10);
await f.close();
```

A `FileHandle` also offers `stat()`, `truncate(offset?)`, `sync()`, `datasync()`, `chmod(mode)`, `utime(atime, mtime)`, and a `path` property describing the open file.

## The `await using` close pattern

`FileHandle` is `AsyncDisposable`: its `close()` is aliased to `Symbol.asyncDispose`. With `await using`, the handle closes automatically when it goes out of scope — even if an exception is thrown — so you never leak a descriptor:

```js
async function firstLine(path) {
    await using f = await tjs.open(path, 'r');
    const buf = new Uint8Array(256);
    const n = await f.read(buf);
    return new TextDecoder().decode(buf.subarray(0, n ?? 0)).split('\n')[0];
    // f.close() runs here, automatically.
}
```

`close()` is idempotent, so an explicit `await f.close()` after an `await using` (or a double close) is harmless.

## Streaming large files

For large files, prefer streams over loading everything into memory. A `FileHandle` exposes a `readable` (`ReadableStream<Uint8Array>`) and a `writable` (`WritableStream<Uint8Array>`). This makes it trivial to copy a file by piping one handle's `readable` into another's `writable`:

```js
await using src = await tjs.open('big-input.bin', 'r');
await using dst = await tjs.open('big-output.bin', 'w');

await src.readable.pipeTo(dst.writable);
```

Because they are standard Web Streams, you can insert any `TransformStream` in between (for example to decompress, hash, or re-encode), and consume `readable` with a `for await` loop:

```js
await using f = await tjs.open('log.txt', 'r');
const decoder = new TextDecoder();
for await (const chunk of f.readable) {
    console.log(decoder.decode(chunk, { stream: true }));
}
```

## Iterating a directory

`tjs.readDir()` resolves to a `DirHandle`, which is an async iterable of `DirEnt` entries. Iterate it with `for await`:

```js
for await (const entry of await tjs.readDir('.')) {
    const kind = entry.isDirectory ? 'dir ' : 'file';
    console.log(`${kind}  ${entry.name}`);
}
```

Each `DirEnt` carries the entry `name` plus type predicates: `isFile`, `isDirectory`, `isSymbolicLink`, `isBlockDevice`, `isCharacterDevice`, `isFIFO`, and `isSocket`.

`DirHandle` is also `AsyncDisposable`. A `for await` loop closes the iterator when it finishes, but if you break out early or keep the handle around, use `await using` to guarantee cleanup:

```js
await using dir = await tjs.readDir('/etc');
for await (const entry of dir) {
    if (entry.name === 'hosts') {
        console.log('found it');
        break; // handle still closes at scope exit
    }
}
```

## Inspecting file metadata

`tjs.stat()` returns a `StatResult`. Use `tjs.lstat()` to stat a symlink itself rather than its target.

```js
const st = await tjs.stat('greeting.txt');
console.log('size:', st.size);                 // bytes
console.log('mode:', (st.mode & 0o777).toString(8)); // permission bits
console.log('modified:', st.mtim);             // Date
console.log('is a file:', st.isFile);
```

`StatResult` includes `dev`, `mode`, `nlink`, `uid`, `gid`, `rdev`, `ino`, `size`, `blksize`, `blocks`, the timestamps `atim`, `mtim`, `ctim`, and `birthtim` (all `Date` objects), and the same type predicates as `DirEnt` (`isFile`, `isDirectory`, `isSymbolicLink`, etc.).

To query the filesystem hosting a path, use `tjs.statFs()`, which resolves to a `StatFsResult` (`type`, `bsize`, `blocks`, `bfree`, `bavail`, `files`, `ffree`):

```js
const fs = await tjs.statFs('/');
const freeBytes = fs.bavail * fs.bsize;
console.log(`${(freeBytes / 1e9).toFixed(1)} GB free`);
```

## Temporary files and directories

`tjs.makeTempDir()` and `tjs.makeTempFile()` create uniquely named temporaries. The template must end in `XXXXXX`, which is replaced with random characters. `makeTempDir()` resolves to the directory path; `makeTempFile()` resolves to an open `FileHandle`.

```js
const dir = await tjs.makeTempDir('build-XXXXXX');
console.log('scratch dir:', dir);

await using tmp = await tjs.makeTempFile('upload-XXXXXX');
await tmp.write(new TextEncoder().encode('staged data'));
console.log('temp file:', tmp.path);
```

Clean up a directory tree with `tjs.remove()`, which deletes recursively (like `rm -rf`):

```js
await tjs.remove(dir);
```

## Directory and path operations

The rest of the filesystem surface mirrors the familiar POSIX calls. All are async.

| Function | Description |
| -------- | ----------- |
| `tjs.makeDir(path, options?)` | Create a directory. Options: `recursive` (create parents), `mode` (defaults to `0o777`). |
| `tjs.remove(path, options?)` | Recursively delete a file or directory. Options: `maxRetries`, `retryDelay`. |
| `tjs.rename(path, newPath)` | Rename or move a path. |
| `tjs.copyFile(path, newPath)` | Copy a file. |
| `tjs.realPath(path)` | Resolve a path to its canonical, absolute form. |
| `tjs.symlink(path, newPath, options?)` | Create a symbolic link. On Windows, `options.type` may be `'file'`, `'directory'`, or `'junction'`. |
| `tjs.link(path, newPath)` | Create a hard link. |
| `tjs.readLink(path)` | Read the target of a symbolic link. |
| `tjs.chmod(path, mode)` | Change permission bits. |
| `tjs.chown(path, uid, gid)` | Change owner and group (`tjs.lchown()` for the link itself). |
| `tjs.utime(path, atime, mtime)` | Set access and modification times (`tjs.lutime()` for the link itself). |

```js
await tjs.makeDir('a/b/c', { recursive: true });
await tjs.copyFile('greeting.txt', 'a/b/c/greeting.txt');
console.log(await tjs.realPath('a/b/c/greeting.txt'));
```

## Watching for changes

`tjs.watch()` calls your handler whenever the watched path changes. Unlike the rest of this API it is synchronous and returns a `FileWatcher`. The handler receives the affected `filename` and an event of `"change"` or `"rename"`.

```js
const watcher = tjs.watch('./src', (filename, event) => {
    console.log(`${event}: ${filename}`);
});

// Later, stop watching:
watcher.close();
```

`FileWatcher` is `Disposable`, so `using` closes it at scope exit:

```js
using watcher = tjs.watch('./src', (filename, event) => {
    console.log(`${event}: ${filename}`);
});
// watcher.close() runs automatically when the block ends.
```

## How it works

All filesystem operations run on libuv's thread pool, so they execute off the main thread and resolve their promises on the event loop. That keeps the runtime responsive: a slow disk read won't stall timers, sockets, or other in-flight work. The `readable` and `writable` accessors on a `FileHandle` are standard Web Streams backed by the same handle, so they interoperate with `fetch()` bodies and any `TransformStream`.

For a higher-level, path-manipulation toolkit (joining, normalizing, parsing paths) see the [`tjs:path`](/docs/api/tjs-path) module, and for the platform APIs that complement filesystem I/O see [Web Platform APIs](../features/web-platform-apis.md).
