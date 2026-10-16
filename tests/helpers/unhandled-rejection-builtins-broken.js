// Breaks every Event constructor: 'load', 'unhandledrejection' and 'beforeunload'.
WeakMap.prototype.set = null;

Promise.reject(new Error('builtins-broken'));
