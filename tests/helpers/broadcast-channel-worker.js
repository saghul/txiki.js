// Joins the 'cluster' BroadcastChannel and answers a ping with a pong; leaves
// on 'stop'.

const bc = new BroadcastChannel('cluster');

bc.onmessage = e => {
    if (e.data === 'ping') {
        bc.postMessage('pong');
    } else if (e.data === 'stop') {
        bc.close();
        self.close();
    }
};

// Signal readiness on the main worker channel.
self.postMessage('ready');
