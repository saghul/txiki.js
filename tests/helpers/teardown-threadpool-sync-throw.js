// Queue a large SHA-1 digest on the threadpool, then throw synchronously while the
// entry script is still evaluating, with no await before it (GitHub issue #1084).

crypto.subtle.digest('SHA-1', new Uint8Array(64 * 1024 * 1024));

notDefined;
