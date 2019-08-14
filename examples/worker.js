
// The 'workerThis' global holds the reference to the worker context.

console.log('[WORKER] Hello from the worker!');
console.log('[WORKER]' + 1+1);

workerThis.postMessage({foo: 42, bar: 'baz!'});
