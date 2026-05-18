// Holder for the path module shared between core and stdlib bundles.
//
// The core bundle populates this object's properties via Object.assign once
// the path implementation is constructed. Consumers (stdlib/path.js,
// polyfills/storage.js, run-main code) read methods off the same object.
//
// User code cannot import this module — the native loader rejects user-land
// `import 'tjs:internal/path'` calls.

const pathModule = {};

export default pathModule;
