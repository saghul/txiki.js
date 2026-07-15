// Keep an fs watcher active, then throw at top level. On this abnormal exit the
// runtime must tear down cleanly (no use-after-free / crash).
tjs.watch(import.meta.dirname, () => {});
await new Promise(r => setTimeout(r, 30));
throw new Error('uncaught with an active fswatch');
