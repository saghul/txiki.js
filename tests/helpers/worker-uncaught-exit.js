const code = 'self.postMessage(\'hi\'); throw new Error(\'boom\');';
const url = URL.createObjectURL(new Blob([ code ], { type: 'text/javascript' }));
const w = new Worker(url);

URL.revokeObjectURL(url);

w.onmessage = e => console.log('got', e.data);
w.onerror = e => {
    console.log('error', e.message);
    e.preventDefault();
};
