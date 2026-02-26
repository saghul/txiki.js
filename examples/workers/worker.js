
console.log('[WORKER] Hello from the worker!');
console.log('[WORKER]' + 1+1);

self.postMessage({foo: 42, bar: 'baz!'});
