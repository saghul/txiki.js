// Queue a large digest on the threadpool, then throw synchronously while the entry
// script is still evaluating, so the event loop never runs (GitHub issue #1084).

crypto.subtle.digest('SHA-1', new Uint8Array(64 * 1024 * 1024));

notDefined;
