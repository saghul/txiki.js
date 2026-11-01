import { runTeardownDrainLateTest } from './helpers/teardown-drain-late-run.js';

await runTeardownDrainLateTest('fetch-port', 'late fetch-port re-issued from a port message');
