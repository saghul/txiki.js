import { runPendingWriteGcTest } from './helpers/gc-pending-write.js';

// Windows hands the whole write to the kernel at once over loopback TCP, so it
// never stays pending and there is nothing for the GC to interrupt.
if (navigator.userAgentData.platform === 'Windows') {
    tjs.exit(0);
}

await runPendingWriteGcTest('tcp');
