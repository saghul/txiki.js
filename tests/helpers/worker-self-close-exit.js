const url = URL.createObjectURL(new Blob([ 'self.postMessage(\'bye\'); self.close();' ], { type: 'text/javascript' }));
const w = new Worker(url);

URL.revokeObjectURL(url);

w.onmessage = e => {
    console.log('got', e.data);

    if (tjs.args.includes('--post-after')) {
        setTimeout(() => {
            w.postMessage('x');
            console.log('posted after close');
        }, 100);
    }
};
