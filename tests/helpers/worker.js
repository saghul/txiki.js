if (self.addSignalListener || self.removeSignalListener) {
    throw new Error('There are signals in a Worker!');
}

self.postMessage({foo: 42, bar: 'baz!'});
