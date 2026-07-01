// Receives a transferred MessagePort on the main worker channel and echoes any
// message sent to that port back with a prefix.

self.onmessage = e => {
    if (!e.ports || !e.ports.length) {
        return;
    }

    const port = e.ports[0];

    port.onmessage = ev => {
        port.postMessage('echo:' + ev.data);

        if (ev.data === 'done') {
            port.close();
            self.close();
        }
    };

    self.postMessage('got-port');
};
