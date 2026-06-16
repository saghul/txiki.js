---
sidebar_position: 3
title: Child Processes
---

# Child Processes

txiki.js can launch and control other programs with `tjs.spawn()`. You get a [`Process`](/docs/api/global.tjs.Interface.Process) handle to wait for exit, capture or feed its standard streams, and send signals — and you can replace the current process image entirely with `tjs.exec()`.

## Spawning a process

`tjs.spawn(args, options?)` starts a child and returns immediately with a `Process`. Pass a single string to run a command, or an array to control `argv` directly.

```js
// Single command (no arguments).
const proc = tjs.spawn('uname');

// Full argv: program plus its arguments.
const ls = tjs.spawn(['ls', '-la', '/tmp']);

console.log('child pid:', proc.pid);
```

By default the child inherits the parent's standard streams, so its output goes straight to your terminal. You can wait for it to finish:

```js
const proc = tjs.spawn([tjs.exePath, '-e', 'console.log(1 + 1)']);
const status = await proc.wait();
console.log(status); // { exit_status: 0, term_signal: null }
```

`tjs.exePath` is the path to the running `tjs` binary — handy for spawning another instance of the runtime.

### Options

`tjs.spawn()` accepts a [`ProcessOptions`](/docs/api/global.tjs.Interface.ProcessOptions) object:

| Option | Type | Description |
|--------|------|-------------|
| `env` | object | Environment variables for the child. Replaces the inherited environment. |
| `cwd` | string | Working directory for the child. |
| `uid` | number | User id to run the child as (POSIX, requires privileges). |
| `gid` | number | Group id to run the child as (POSIX, requires privileges). |
| `stdin` | `ProcessStdio` | How to set up the child's standard input. |
| `stdout` | `ProcessStdio` | How to set up the child's standard output. |
| `stderr` | `ProcessStdio` | How to set up the child's standard error. |

Each stdio option is a [`ProcessStdio`](/docs/api/global.tjs.TypeAlias.ProcessStdio) value:

| Value | Behavior |
|-------|----------|
| `"inherit"` | Share the parent's stream (the default behavior). |
| `"pipe"` | Create a pipe; exposed on `proc.stdin` / `proc.stdout` / `proc.stderr`. |
| `"ignore"` | Connect the stream to the equivalent of `/dev/null`. |

Setting the environment and working directory:

```js
const proc = tjs.spawn([tjs.exePath, '-e', 'console.log(JSON.stringify(tjs.env))'], {
    env: { FOO: 'BAR', SPAM: 'EGGS' },
    cwd: '/tmp',
});
await proc.wait();
```

## Capturing output

Set `stdout` (and/or `stderr`) to `"pipe"`, then drain the stream. `proc.stdout` is a [`ProcessReadableStream`](/docs/api/global.tjs.Interface.ProcessReadableStream) — a `ReadableStream<Uint8Array>` with convenience methods that read the stream to completion:

| Method | Returns |
|--------|---------|
| `text()` | `Promise<string>` — decodes the output as UTF-8. |
| `bytes()` | `Promise<Uint8Array>` — the raw bytes. |
| `arrayBuffer()` | `Promise<ArrayBuffer>` — the raw bytes as an `ArrayBuffer`. |

```js
const proc = tjs.spawn(['echo', 'hello from a child'], { stdout: 'pipe' });
const output = await proc.stdout.text();
console.log(output.trimEnd()); // "hello from a child"
await proc.wait();
```

Capture stderr separately by piping it too:

```js
const proc = tjs.spawn(['ls', '/does-not-exist'], {
    stdout: 'pipe',
    stderr: 'pipe',
});
// Drain both pipes and wait for exit concurrently. Awaiting one stream fully
// before the other risks deadlocking if the child fills the second pipe's buffer.
const [out, err, status] = await Promise.all([
    proc.stdout.text(),
    proc.stderr.text(),
    proc.wait(),
]);
console.log({ exit_status: status.exit_status, err });
```

`proc.stdin`, `proc.stdout`, and `proc.stderr` are `null` unless the matching option was set to `"pipe"`.

## Writing to stdin

With `stdin: 'pipe'`, `proc.stdin` is a `WritableStream<Uint8Array>`. Get a writer, encode your data, and write it. Close the writer to signal end-of-input.

```js
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const proc = tjs.spawn('cat', { stdin: 'pipe', stdout: 'pipe' });
const writer = proc.stdin.getWriter();
const reader = proc.stdout.getReader();

await writer.write(encoder.encode('hello!'));
let chunk = await reader.read();
console.log(decoder.decode(chunk.value)); // "hello!"

await writer.write(encoder.encode('hello again!'));
chunk = await reader.read();
console.log(decoder.decode(chunk.value)); // "hello again!"

writer.close();
const status = await proc.wait();
console.log(status);
```

## Waiting for exit

`proc.wait()` resolves once the child exits, returning a [`ProcessStatus`](/docs/api/global.tjs.Interface.ProcessStatus):

| Field | Type | Description |
|-------|------|-------------|
| `exit_status` | number | The process exit code. |
| `term_signal` | `Signal \| null` | The signal that terminated the process, or `null` if it exited normally. |

```js
const proc = tjs.spawn([tjs.exePath, '-e', 'tjs.exit(3)']);
const { exit_status, term_signal } = await proc.wait();
console.log(exit_status, term_signal); // 3 null
```

`wait()` can be awaited more than once; later calls resolve with the same status.

## Sending signals

Use `proc.kill(signal?)` to send a signal to the child. The signal defaults to `SIGTERM`. When a process is killed by a signal, `term_signal` in its status reflects which one.

```js
const proc = tjs.spawn('cat'); // reads stdin forever
proc.kill('SIGTERM');
const status = await proc.wait();
console.log(status.term_signal); // "SIGTERM"
```

To signal an arbitrary process by pid, use `tjs.kill(pid, sig?)` (also defaulting to `SIGTERM`):

```js
tjs.kill(proc.pid, 'SIGKILL');
```

See the [`Signal`](/docs/api/global.tjs.TypeAlias.Signal) type for the full list of accepted signal names (`"SIGINT"`, `"SIGTERM"`, `"SIGKILL"`, `"SIGHUP"`, and so on).

## Automatic cleanup with `await using`

`Process` is `AsyncDisposable`, so `await using` ties the child's lifetime to a scope. When the scope exits, txiki.js sends `SIGTERM` (best effort) and awaits `wait()` — even if you return early or an exception is thrown.

```js
async function tailLog() {
    await using proc = tjs.spawn(['tail', '-f', '/var/log/system.log'], {
        stdout: 'pipe',
    });
    const reader = proc.stdout.getReader();
    for (let i = 0; i < 5; i++) {
        const { value } = await reader.read();
        console.log(new TextDecoder().decode(value));
    }
    // Leaving the scope sends SIGTERM and awaits the process.
}
```

This is the simplest way to make sure long-running children don't outlive the code that started them.

## Replacing the current process

`tjs.exec(args)` replaces the running process image with a new program via [`execvp(3)`](https://man7.org/linux/man-pages/man3/execvp.3.html). Unlike `spawn`, it does **not** create a child and **does not return** on success — the new program takes over the same pid. Any code after a successful `exec` never runs.

```js
// Hand control over to another program. Nothing below runs if exec succeeds.
tjs.exec(['env', 'FOO=bar', 'printenv', 'FOO']);
console.log('this only prints if exec failed');
```

Use `exec` for wrapper scripts that set up state and then become another program; use `spawn` whenever you need to keep running alongside the child.

## How it works

`tjs.spawn()` is a thin wrapper over libuv's process spawning. The child is launched asynchronously and the event loop keeps running while it executes, so awaiting `wait()` or reading a piped stream never blocks other work. Piped streams are real `ReadableStream`/`WritableStream` objects, which means you can pipe them through transform streams, `tee()` them, or hand them to any Web Streams consumer.

## Process-wide signal handling

To react to signals delivered to the txiki.js process itself (rather than signalling a child), register a listener with `tjs.addSignalListener(sig, listener)` and remove it with `tjs.removeSignalListener(sig, listener)`:

```js
function onInterrupt() {
    console.log('caught SIGINT, cleaning up...');
    tjs.removeSignalListener('SIGINT', onInterrupt);
    tjs.exit(0);
}

tjs.addSignalListener('SIGINT', onInterrupt);
```

A registered signal listener keeps the event loop alive, so the program will not exit on its own while one is active.

## See also

- [Modules](modules.md) — importing code and stdlib modules.
- [Web Platform APIs](../features/web-platform-apis.md) — streams and encoders used with piped stdio.
- API reference: [`tjs.spawn`](/docs/api/global.tjs.Function.spawn), [`tjs.exec`](/docs/api/global.tjs.Function.exec), [`tjs.kill`](/docs/api/global.tjs.Function.kill), [`tjs.addSignalListener`](/docs/api/global.tjs.Function.addSignalListener).
