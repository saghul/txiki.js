import path from 'tjs:path';

// Keep a child process running, then throw at top level. On this abnormal exit
// the runtime must tear down cleanly (no use-after-free / crash).
tjs.spawn([ tjs.exePath, 'run', path.join(import.meta.dirname, 'sleep.js') ], { stdout: 'ignore', stderr: 'ignore' });
await new Promise(r => setTimeout(r, 30));
throw new Error('uncaught with a running child');
