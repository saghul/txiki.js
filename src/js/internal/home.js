/* global tjs */

// Resolves the txiki.js home directory: $TJS_HOME, or ~/.tjs by default.
//
// This is computed on every call, not cached: standalone tpk apps point
// TJS_HOME at their cache directory at runtime, and lazy consumers (such as
// localStorage) must see that value.
//
// User code cannot import this module — the native loader rejects user-land
// `import 'tjs:internal/home'` calls.

import path from 'tjs:internal/path';

export function getTjsHome() {
    return tjs.env.TJS_HOME ?? path.join(tjs.homeDir, '.tjs');
}
